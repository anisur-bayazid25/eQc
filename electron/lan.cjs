// LAN collaboration: UDP host discovery + WebSocket host/client + chunked
// project sync + live action broadcasting + presence. Runs entirely in the
// main process (dgram + ws); the renderer talks to it via IPC.
//
// Model (chosen with the user): every accepted project state is a full
// snapshot with an increasing `seq`. The host is the single source of truth;
// it orders snapshots and fans them out to connected clients. Rejoining peers
// send the sequence number they last applied, and the host hands them only
// the newest snapshot (minimal transfer, last-writer-wins concurrency).

const dgram = require('node:dgram');
const os = require('node:os');
const { Server: WebSocketServer, WebSocket } = require('ws');

const UDP_PORT = 8082;
const WS_PORT = 8080;
const CHUNK_SIZE = 500 * 1024;
const BEACON_INTERVAL_MS = 2000;
const HOST_PRUNE_MS = 6000;

function localIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function sendMsg(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

module.exports = function setupLan(ipcMain, { getWindow, saveProject }) {
  const state = {
    role: null,             // 'host' | 'client' | null
    host: null,
    client: null,
    broadcastSocket: null,
    discoverySocket: null,
    localProbeTimer: null,
    pruneTimer: null,
    hostsByKey: new Map()
  };

  function pushToRenderer(channel, payload) {
    const win = getWindow ? getWindow() : null;
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }

  function pushHostsList() {
    pushToRenderer('lan:hostsUpdated', [...state.hostsByKey.values()]);
  }

  function pushProgress(p) {
    pushToRenderer('lan:syncProgress', p);
  }

  function clearSessionUI() {
    pushToRenderer('lan:sessionState', null);
    pushToRenderer('lan:syncProgress', { phase: 'done', percent: 0, message: '' });
  }

  // ===================== HOST =====================

  async function startHost({ hostName, password, project }) {
    stopHost();
    stopClient();
    stopDiscovery();

    const server = new WebSocketServer({ port: WS_PORT });
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    state.role = 'host';
    state.host = {
      hostName: String(hostName || 'Coder'),
      password: String(password || ''),
      projectId: project.id,
      // The session is LOCKED to exactly this project id for its whole
      // life. Everything broadcast into the session must carry this id;
      // anything else is rejected at the door (see acceptDispatch). It is
      // captured once here and never re-read from any later project state,
      // so reopening/renaming a different project can never leak into the
      // session.
      sessionProjectId: project.id,
      projectName: project.name,
      currentProject: project,
      seq: 0,
      log: [],
      activeDocId: null,       // doc/image the host renderer is currently viewing
      clients: new Map(),
      clientSeq: 0,            // per-connection ids so the host can kick one alive client by id
      heartbeatTimer: null,
      server
    };
    server.on('connection', handleClientConnection);
    // Heartbeat keeps the session alive: without it, routers/NAT drop the
    // idle WebSocket after a few minutes and the session silently "ends".
    // Ping every 30s; terminate peers that miss a full cycle.
    state.host.heartbeatTimer = setInterval(heartbeatClients, 30000);
    startBroadcast();
    broadcastPresence();
    return { ok: true, wsPort: WS_PORT, ip: localIPv4() };
  }

function stopHost() {
    if (state.host && state.host.server) {
      for (const ws of state.host.clients.keys()) { try { ws.close(); } catch {} }
      try { state.host.server.close(); } catch {}
    }
    if (state.host && state.host.heartbeatTimer) clearInterval(state.host.heartbeatTimer);
    if (state.broadcastSocket) { try { state.broadcastSocket.close(); } catch {} state.broadcastSocket = null; }
    if (state.host && state.host.beaconTimer) clearInterval(state.host.beaconTimer);
    state.host = null;
    if (state.role === 'host') { state.role = null; clearSessionUI(); }
  }

  function heartbeatClients() {
    if (state.role !== 'host' || !state.host) return;
    let changed = false;
    for (const ws of state.host.clients.keys()) {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        state.host.clients.delete(ws);
        changed = true;
      } else {
        ws.isAlive = false;
        try { ws.ping(); } catch {}
      }
    }
    if (changed) broadcastPresence();
  }

  function kickClient(clientId) {
    if (state.role !== 'host' || !state.host) return { ok: false, error: 'Not hosting' };
    const id = String(clientId || '');
    for (const [ws, info] of state.host.clients) {
      if (info.clientId === id) {
        // Tell the peer it was removed (so its UI can say "host disconnected
        // you" instead of guessing), then close. The socket's 'close' handler
        // removes it from the roster and re-broadcasts presence.
        sendMsg(ws, { type: 'KICKED', reason: 'You were disconnected by the host' });
        try { ws.close(1000); } catch {}
        return { ok: true };
      }
    }
    return { ok: false, error: 'Client not found' };
  }

  function startBroadcast() {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', () => {});
    sock.on('message', (msg, rinfo) => {
      // Manual IP fallback: a peer that cannot receive our broadcast asks by
      // IP; reply with a beacon straight to that peer.
      let p;
      try { p = JSON.parse(String(msg)); } catch { return; }
      if (!state.host || !p || p.type !== 'lan-ping') return;
      const reply = Buffer.from(JSON.stringify({
        type: 'project-beacon',
        hostName: state.host.hostName,
        projectName: state.host.projectName,
        projectId: state.host.projectId,
        wsPort: WS_PORT,
        requiresPassword: Boolean(state.host.password),
        ip: localIPv4()
      }));
      sock.send(reply, 0, reply.length, rinfo.port, rinfo.address);
    });
    sock.bind(UDP_PORT, () => {
      sock.setBroadcast(true);
      sendBeacon();
      if (state.host) state.host.beaconTimer = setInterval(sendBeacon, BEACON_INTERVAL_MS);
    });
    function sendBeacon() {
      if (!state.host) return;
      const msg = Buffer.from(JSON.stringify({
        type: 'project-beacon',
        hostName: state.host.hostName,
        projectName: state.host.projectName,
        projectId: state.host.projectId,
        wsPort: WS_PORT,
        requiresPassword: Boolean(state.host.password),
        ip: localIPv4()
      }));
      sock.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
      // Also beacon to loopback so a second app instance on this same
      // machine can discover the session for local testing (Windows often
      // does not loop back subnet broadcasts).
      sock.send(msg, 0, msg.length, UDP_PORT, '127.0.0.1');
    }
    state.broadcastSocket = sock;
  }

  function broadcastPresence() {
    if (state.role !== 'host' || !state.host) return;
    const coders = [
      { coderName: state.host.hostName, source: 'host', activeDocId: state.host.activeDocId },
      ...[...state.host.clients.values()].map(c => ({ coderName: c.coderName, source: 'client', activeDocId: c.activeDocId || null, clientId: c.clientId }))
    ];
    // The host renderer reports itself as the host…
    pushToRenderer('lan:sessionState', {
      role: 'host',
      projectId: state.host.projectId,
      myName: state.host.hostName,
      coders
    });
    // …but every connected client must see ITS OWN role ('client'), own
    // name, and who the host is. Previously clients were told role='host',
    // which made the client UI show the host's "Stop Session" button and
    // hide the Disconnect button.
    for (const [ws, info] of state.host.clients) {
      sendMsg(ws, {
        type: 'PRESENCE',
        payload: {
          role: 'client',
          projectId: state.host.projectId,
          myName: info.coderName,
          hostName: state.host.hostName,
          coders
        }
      });
    }
  }

  function handleClientConnection(ws, req) {
    let authed = false;
    ws.coderName = 'Coder';
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', data => {
      ws.isAlive = true;
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (!msg) return;

      if (msg.type === 'LAN_HELLO') {
        // Pre-auth handshake used by the same-machine discovery probe
        // (UDP loopback delivery is ambiguous when two sockets share the
        // port on Windows, so local discovery goes over WebSocket instead).
        sendMsg(ws, {
          type: 'LAN_HELLO_INFO',
          hostName: state.host.hostName,
          projectName: state.host.projectName,
          projectId: state.host.projectId,
          wsPort: WS_PORT,
          requiresPassword: Boolean(state.host.password)
        });
        setTimeout(() => { try { ws.close(); } catch {} }, 30);
        return;
      }

      if (msg.type === 'AUTH_REQUEST') {
        if (state.role !== 'host' || !state.host) return;
        if (String(msg.password || '') !== String(state.host.password || '')) {
          sendMsg(ws, { type: 'AUTH_FAILED', reason: 'Invalid password' });
          setTimeout(() => { try { ws.close(); } catch {} }, 50);
          return;
        }
        authed = true;
        ws.coderName = String(msg.coderName || 'Coder');
        // Unique per-connection id so the host can disconnect exactly this
        // client later (coderName is not unique — duplicates are legal).
        const clientId = `c${++state.host.clientSeq}`;
        state.host.clients.set(ws, { coderName: ws.coderName, activeDocId: null, clientId });
        broadcastPresence();

        // Always hand the peer the host's current project: on every (re)join
        // the host's project is the single source of truth, so the joiner is
        // guaranteed to end up viewing exactly what the host shares.
        const seq = state.host.seq;
        if (state.host.currentProject) {
          const json = JSON.stringify(state.host.currentProject);
          const totalChunks = Math.ceil(json.length / CHUNK_SIZE);
          sendMsg(ws, { type: 'AUTH_SUCCESS', projectId: state.host.projectId, sessionProjectId: state.host.sessionProjectId, seq, totalChunks, totalSize: json.length });
          streamChunks(ws, json, totalChunks);
        } else {
          sendMsg(ws, { type: 'AUTH_SUCCESS', projectId: state.host.projectId, sessionProjectId: state.host.sessionProjectId, seq, totalChunks: 0, totalSize: 0 });
        }
      } else if (msg.type === 'ACTION_DISPATCH' && authed && state.host) {
        acceptDispatch({ coderName: ws.coderName, project: msg.project, senderWs: ws, notifyHostRenderer: true });
      } else if (msg.type === 'SET_ACTIVE_DOC' && authed && state.host) {
        // Presence: a client tells the host which document/image it is
        // currently viewing. The host stores it and re-broadcasts PRESENCE
        // so everyone's DocTree can show "who is viewing what".
        const info = state.host.clients.get(ws);
        if (info) {
          info.activeDocId = (msg.docId === null || msg.docId === undefined) ? null : String(msg.docId);
          broadcastPresence();
        }
      }
    });
    ws.on('close', () => {
      if (state.host && state.host.clients.has(ws)) {
        state.host.clients.delete(ws);
        broadcastPresence();
      }
    });
    ws.on('error', () => {});
  }

  function streamChunks(ws, json, totalChunks) {
    for (let i = 0; i < totalChunks; i++) {
      sendMsg(ws, { type: 'SYNC_CHUNK', chunkIndex: i, totalChunks, data: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
    }
  }

  function acceptDispatch({ coderName, project, senderWs, notifyHostRenderer }) {
    if (state.role !== 'host' || !state.host) return { ok: false, error: 'Not hosting' };
    if (!project || !project.id) return { ok: false, error: 'Invalid project payload' };
    // Hard project-id lock: the session was started for exactly ONE project
    // (state.host.sessionProjectId). A dispatch for any other project is
    // rejected outright — it is NOT stored, NOT re-broadcast, and does not
    // touch state.host.currentProject. The single offending sender is told
    // why so their UI can show a notice instead of silently guessing.
    if (state.host.sessionProjectId && project.id !== state.host.sessionProjectId) {
      if (senderWs) sendMsg(senderWs, { type: 'REJECTED', reason: 'project-mismatch' });
      return { ok: false, error: 'project-mismatch' };
    }
    const seq = ++state.host.seq;
    state.host.currentProject = project;
    state.host.log.push({ seq, coderName: String(coderName || 'Coder') });
    if (state.host.log.length > 1000) state.host.log.shift();
    const broadcast = { type: 'ACTION_DISPATCH', seq, coderName: String(coderName || 'Coder'), project };
    for (const ws of state.host.clients.keys()) {
      if (ws !== senderWs) sendMsg(ws, broadcast);
    }
    if (notifyHostRenderer) pushToRenderer('lan:remoteProject', { seq, coderName: String(coderName || 'Coder'), project });
    return { ok: true, seq };
  }

  // ===================== DISCOVERY =====================

  function startDiscovery() {
    if (state.discoverySocket) return { ok: true };
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', () => {});
    sock.on('message', msg => {
      let p;
      try { p = JSON.parse(String(msg)); } catch { return; }
      if (!p || p.type !== 'project-beacon' || !p.ip || !p.wsPort) return;
      const key = `${p.ip}:${p.wsPort}`;
      state.hostsByKey.set(key, {
        hostName: String(p.hostName || 'Coder'),
        projectName: String(p.projectName || 'Project'),
        projectId: String(p.projectId || ''),
        wsPort: p.wsPort,
        requiresPassword: Boolean(p.requiresPassword),
        ip: p.ip,
        lastSeen: Date.now()
      });
      pushHostsList();
    });
    sock.bind(UDP_PORT, () => {});
    state.discoverySocket = sock;
    state.pruneTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, h] of state.hostsByKey) {
        if (now - h.lastSeen > HOST_PRUNE_MS) state.hostsByKey.delete(k);
      }
      pushHostsList();
    }, 2000);
    probeLocalhost();
    state.localProbeTimer = setInterval(probeLocalhost, BEACON_INTERVAL_MS);
    return { ok: true };
  }

  function probeLocalhost() {
    // Same-machine discovery: ask 127.0.0.1:8080 directly over WebSocket,
    // bypassing the ambiguous UDP loopback delivery entirely.
    let ws;
    try { ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`); } catch { return; }
    let done = false;
    const settled = () => {
      if (done) return;
      done = true;
      if (to) clearTimeout(to);
      try { ws.close(); } catch {}
    };
    let to = setTimeout(settled, 1500);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'LAN_HELLO' })));
    ws.on('message', data => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m.type !== 'LAN_HELLO_INFO') return;
      state.hostsByKey.set(`127.0.0.1:${WS_PORT}`, {
        hostName: String(m.hostName || 'Coder'),
        projectName: String(m.projectName || 'Project'),
        projectId: String(m.projectId || ''),
        wsPort: WS_PORT,
        requiresPassword: Boolean(m.requiresPassword),
        ip: '127.0.0.1',
        lastSeen: Date.now()
      });
      pushHostsList();
      settled();
    });
    ws.on('error', () => settled());
    ws.on('close', () => settled());
  }

  function stopDiscovery() {
    if (state.discoverySocket) { try { state.discoverySocket.close(); } catch {} state.discoverySocket = null; }
    if (state.pruneTimer) clearInterval(state.pruneTimer);
    state.pruneTimer = null;
    if (state.localProbeTimer) clearInterval(state.localProbeTimer);
    state.localProbeTimer = null;
  }

  function pingHost(ip) {
    if (!state.discoverySocket) startDiscovery();
    const hostIp = String(ip || '').trim();
    if (!hostIp || !state.discoverySocket) return { ok: false, error: 'No IP given' };
    const msg = Buffer.from(JSON.stringify({ type: 'lan-ping' }));
    state.discoverySocket.send(msg, 0, msg.length, UDP_PORT, hostIp, () => {});
    return { ok: true };
  }

  // ===================== CLIENT =====================

  function joinSession({ hostIp, wsPort, password, coderName, projectId, lastSeq }) {
    if (state.role === 'host') stopHost();
    stopClient();
    stopDiscovery();

    return new Promise(resolve => {
      let settled = false;
      const client = {
        ws: null,
        hostIp: String(hostIp || ''),
        wsPort: Number(wsPort || 8080),
        password: String(password || ''),
        lastSeq: (lastSeq === null || lastSeq === undefined) ? null : Number(lastSeq),
        coderName: String(coderName || 'Coder'),
        projectId: String(projectId || ''),
        // Locked to the shared project id handed back by the host on
        // AUTH_SUCCESS. Used to discard any dispatch that is not about this
        // project (buffered, live, or replayed).
        sessionProjectId: null,
        chunks: [],
        totalChunks: 0,
        buffered: [],
        syncing: false,
        resolved: false,
        reconnectTimer: null,
        reconnectAttempts: 0,
        userStopped: false
      };
      state.client = client;
      pushProgress({ phase: 'connect', percent: 0, message: 'Connecting…' });

      function cancelReconnect() {
        if (client.reconnectTimer) { clearInterval(client.reconnectTimer); client.reconnectTimer = null; }
      }

      function formalDisconnect(reason) {
        cancelReconnect();
        if (state.client === client) { state.client = null; clearSessionUI(); }
        if (state.role === 'client' || !settled) state.role = null;
        pushProgress({ phase: 'error', percent: 0, message: reason });
        if (!settled) { settled = true; resolve({ ok: false, error: reason }); }
      }

      function fail(reason) {
        formalDisconnect(reason);
        if (client.ws) { try { client.ws.close(); } catch {} }
      }

      function connect() {
        let ws;
        try { ws = new WebSocket(`ws://${client.hostIp}:${client.wsPort}`); }
        catch (err) { return; }
        client.ws = ws;

        ws.on('open', () => {
          pushProgress({ phase: 'auth', percent: 5, message: client.resolved ? 'Reconnecting…' : 'Authenticating…' });
          sendMsg(ws, { type: 'AUTH_REQUEST', password: client.password, coderName: client.coderName, lastSeq: client.lastSeq });
        });

        ws.on('message', data => {
          let msg;
          try { msg = JSON.parse(String(data)); } catch { return; }
          if (!msg) return;

          if (msg.type === 'AUTH_FAILED') {
            fail(msg.reason || 'Authentication failed');
            return;
          }

          if (msg.type === 'AUTH_SUCCESS') {
            client.seq = msg.seq;
            client.totalChunks = msg.totalChunks || 0;
            client.sessionProjectId = String(msg.sessionProjectId || msg.projectId || '');
            client.syncing = client.totalChunks > 0;
            if (!client.syncing) finishJoin(null);
            return;
          }

          if (msg.type === 'SYNC_CHUNK') {
            client.chunks[msg.chunkIndex] = msg.data || '';
            pushProgress({
              phase: 'sync',
              percent: Math.round(((msg.chunkIndex + 1) / (msg.totalChunks || 1)) * 100),
              received: msg.chunkIndex + 1,
              total: msg.totalChunks
            });
            if (msg.chunkIndex === (msg.totalChunks || 0) - 1) {
              let project = null;
              try { project = JSON.parse(client.chunks.join('')); } catch { fail('Could not parse host project data'); return; }
              saveProject(project); // dual local persistence — never touches other project rows
              finishJoin(project);
            }
            return;
          }

          if (msg.type === 'ACTION_DISPATCH') {
            // The session is locked to ONE project id. A dispatch about any
            // other project is dropped here so it can't replace the wrong
            // screen — and it is not buffered for later replay either.
            if (client.sessionProjectId && msg.project && msg.project.id !== client.sessionProjectId) {
              return;
            }
            if (client.syncing) {
              client.buffered.push(msg); // live edits that raced the (re)sync
            } else {
              pushToRenderer('lan:remoteProject', { seq: msg.seq, coderName: msg.coderName, project: msg.project });
            }
            return;
          }

          if (msg.type === 'REJECTED') {
            // The host refused our last dispatch (e.g. project mismatch).
            // Surface the reason so the renderer can show a clear notice.
            pushToRenderer('lan:rejected', { reason: msg.reason || 'project-mismatch' });
            return;
          }

          if (msg.type === 'KICKED') {
            // The host decided to disconnect us. Close the socket ourselves so
            // the running 'close' handler sees no further work (state.client
            // is already nulled), then tell the user why the session ended.
            formalDisconnect(msg.reason || 'You were disconnected by the host');
            try { ws.close(); } catch {}
            return;
          }

          if (msg.type === 'PRESENCE') {
            pushToRenderer('lan:sessionState', msg.payload);
          }
        });

        ws.on('close', code => {
          if (state.client !== client) return;
          if (!client.resolved) {
            // Initial join interrupted before we ever had a session — fail it.
            if (!settled) {
              settled = true;
              state.role = null;
              if (state.client === client) { state.client = null; clearSessionUI(); }
              resolve({ ok: false, error: 'Connection closed before sync completed' });
            }
            return;
          }
          if (client.userStopped) return;
          // A clean server close (1000) while in session = the host/session
          // ended → formal disconnect. Anything else is treated as a network
          // drop → silent reconnect grace period (10s, attempt every 2s).
          if (code === 1000) {
            formalDisconnect('Connection to host closed');
            return;
          }
          if (client.reconnectTimer) return; // already buffering
          pushProgress({ phase: 'reconnect', percent: 0, message: 'Network interrupted. Reconnecting…' });
          client.reconnectAttempts = 0;
          client.reconnectTimer = setInterval(() => {
            client.reconnectAttempts++;
            if (client.reconnectAttempts > 5) {
              formalDisconnect('Connection lost. Reconnect failed.');
              return;
            }
            if (client.userStopped || state.client !== client) { cancelReconnect(); return; }
            // Skip if a socket is still CONNECTING(0) / OPEN(1).
            if (client.ws && client.ws.readyState !== 2 && client.ws.readyState !== 3) return;
            pushProgress({ phase: 'reconnect', percent: 0, message: `Network interrupted. Reconnecting (attempt ${client.reconnectAttempts}/5)…` });
            connect();
          }, 2000);
        });

        ws.on('error', error => {
          // For the initial join an error is fatal; after that it just routes
          // through `close` (fires right after) into the reconnect machinery.
          if (!client.resolved && !settled) fail((error && error.message) || String(error));
        });
      }

      function finishJoin(project) {
        client.syncing = false;
        // Defense in depth on replay: buffered dispatches were already
        // filtered at buffer time, but re-check the lock here anyway so a
        // dispatch for the wrong project can never be replayed after sync.
        const buffered = client.buffered.filter(
          b => !client.sessionProjectId || !b.project || b.project.id === client.sessionProjectId
        );
        if (client.resolved) {
          // Reconnect landed: flush any edits that raced the re-sync, then
          // hand the fresh snapshot to the renderer so its in-memory state is
          // always current. Marked `quiet` so it restores state without a
          // "someone updated the project" toast.
          for (const b of buffered) {
            pushToRenderer('lan:remoteProject', { seq: b.seq, coderName: b.coderName, project: b.project, quiet: true });
          }
          if (project) {
            pushToRenderer('lan:remoteProject', { seq: client.seq || 0, coderName: client.coderName, project, quiet: true });
          }
          pushProgress({ phase: 'done', percent: 100, message: 'Reconnected' });
          return;
        }
        client.resolved = true;
        state.role = 'client';
        for (const b of buffered) {
          pushToRenderer('lan:remoteProject', { seq: b.seq, coderName: b.coderName, project: b.project });
        }
        pushProgress({ phase: 'done', percent: project ? 100 : 100, message: project ? 'Project synced' : 'Up to date' });
        cancelReconnect();
        settled = true;
        resolve({ ok: true, project: project || null, seq: client.seq });
      }

      connect();
    });
  }

  function stopClient() {
    // User-initiated: cancel any reconnect buffer before closing, otherwise
    // the socket's 'close' handler would start a 10s reconnect loop.
    if (state.client) {
      state.client.userStopped = true;
      if (state.client.reconnectTimer) { clearInterval(state.client.reconnectTimer); state.client.reconnectTimer = null; }
      if (state.client.ws) { try { state.client.ws.close(); } catch {} }
      state.client = null;
    }
    if (state.role === 'client') { state.role = null; clearSessionUI(); }
  }

  // ===================== IPC =====================

  function applyPublish(payload) {
    const project = payload && payload.project;
    const coderName = (payload && payload.coderName) || 'Coder';
    if (state.role === 'host') {
      return acceptDispatch({ coderName, project, senderWs: null, notifyHostRenderer: false });
    }
    if (state.role === 'client' && state.client && state.client.ws.readyState === 1) {
      if (state.client.sessionProjectId && project && project.id !== state.client.sessionProjectId) {
        return { ok: false, error: 'project-mismatch' };
      }
      sendMsg(state.client.ws, { type: 'ACTION_DISPATCH', coderName, project });
      return { ok: true };
    }
    return { ok: false, error: 'Not connected to a LAN session' };
  }

  ipcMain.handle('lan:startHost', async (_e, config) => {
    try {
      return await startHost(config || {});
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  });
  ipcMain.handle('lan:stopHost', () => { stopHost(); return { ok: true }; });
  ipcMain.handle('lan:kickClient', (_e, clientId) => kickClient(clientId));
  ipcMain.handle('lan:startDiscovery', () => startDiscovery());
  ipcMain.handle('lan:stopDiscovery', () => { stopDiscovery(); return true; });
  ipcMain.handle('lan:pingHost', (_e, ip) => pingHost(ip));
  ipcMain.handle('lan:joinSession', (_e, creds) => joinSession(creds || {}));
  ipcMain.handle('lan:disconnectSession', () => { stopClient(); return true; });
  ipcMain.handle('lan:sendAction', (_e, payload) => applyPublish(payload));
  ipcMain.handle('lan:setActiveDoc', (_e, docId) => {
    const did = (docId === null || docId === undefined) ? null : String(docId);
    if (state.role === 'host' && state.host) {
      state.host.activeDocId = did;
      broadcastPresence();
    } else if (state.role === 'client' && state.client && state.client.ws && state.client.ws.readyState === 1) {
      // Clients keep the host as the single source of truth, so their
      // "currently viewing" state is forwarded to the host, which then
      // re-broadcasts presence to everyone.
      sendMsg(state.client.ws, { type: 'SET_ACTIVE_DOC', docId: did });
    }
    return true;
  });
};