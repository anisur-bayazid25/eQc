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
      projectName: project.name,
      currentProject: project,
      seq: 0,
      log: [],
      clients: new Map(),
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
      { coderName: state.host.hostName, source: 'host' },
      ...[...state.host.clients.values()].map(c => ({ coderName: c.coderName, source: 'client' }))
    ];
    pushToRenderer('lan:sessionState', {
      role: 'host',
      projectId: state.host.projectId,
      myName: state.host.hostName,
      coders
    });
    for (const ws of state.host.clients.keys()) sendMsg(ws, { type: 'PRESENCE', payload: { role: 'host', projectId: state.host.projectId, myName: state.host.hostName, coders } });
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
        state.host.clients.set(ws, { coderName: ws.coderName });
        broadcastPresence();

        // Always hand the peer the host's current project: on every (re)join
        // the host's project is the single source of truth, so the joiner is
        // guaranteed to end up viewing exactly what the host shares.
        const seq = state.host.seq;
        if (state.host.currentProject) {
          const json = JSON.stringify(state.host.currentProject);
          const totalChunks = Math.ceil(json.length / CHUNK_SIZE);
          sendMsg(ws, { type: 'AUTH_SUCCESS', projectId: state.host.projectId, seq, totalChunks, totalSize: json.length });
          streamChunks(ws, json, totalChunks);
        } else {
          sendMsg(ws, { type: 'AUTH_SUCCESS', projectId: state.host.projectId, seq, totalChunks: 0, totalSize: 0 });
        }
      } else if (msg.type === 'ACTION_DISPATCH' && authed && state.host) {
        acceptDispatch({ coderName: ws.coderName, project: msg.project, senderWs: ws, notifyHostRenderer: true });
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
    if (state.host.projectId && project.id !== state.host.projectId) {
      return { ok: false, error: 'Project mismatch — only the shared session project can be synced' };
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
      const ws = new WebSocket(`ws://${hostIp}:${wsPort}`);
      const client = {
        ws,
        coderName: String(coderName || 'Coder'),
        projectId: String(projectId || ''),
        chunks: [],
        totalChunks: 0,
        buffered: [],
        syncing: false,
        resolved: false
      };
      state.client = client;
      pushProgress({ phase: 'connect', percent: 0, message: 'Connecting…' });

      function fail(reason) {
        if (state.client === client) { state.client = null; clearSessionUI(); }
        if (state.role === 'client' || !settled) state.role = null;
        pushProgress({ phase: 'error', percent: 0, message: reason });
        if (!settled) { settled = true; resolve({ ok: false, error: reason }); }
        try { ws.close(); } catch {}
      }

      ws.on('open', () => {
        pushProgress({ phase: 'auth', percent: 5, message: 'Authenticating…' });
        sendMsg(ws, { type: 'AUTH_REQUEST', password: String(password || ''), coderName: client.coderName, lastSeq });
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
          if (client.syncing) {
            client.buffered.push(msg); // live edits that raced the initial sync
          } else {
            pushToRenderer('lan:remoteProject', { seq: msg.seq, coderName: msg.coderName, project: msg.project });
          }
          return;
        }

        if (msg.type === 'PRESENCE') {
          pushToRenderer('lan:sessionState', msg.payload);
        }
      });

      ws.on('close', () => {
        if (state.client === client) { state.client = null; clearSessionUI(); }
        if (!settled) { settled = true; state.role = null; resolve({ ok: false, error: 'Connection closed before sync completed' }); }
      });

      ws.on('error', err => {
        if (!settled) fail(err.message || String(err));
      });

      function finishJoin(project) {
        if (client.resolved) return;
        client.resolved = true;
        state.role = 'client';
        client.syncing = false;
        for (const b of client.buffered) {
          pushToRenderer('lan:remoteProject', { seq: b.seq, coderName: b.coderName, project: b.project });
        }
        pushProgress({ phase: 'done', percent: project ? 100 : 100, message: project ? 'Project synced' : 'Up to date' });
        settled = true;
        resolve({ ok: true, project: project || null, seq: client.seq });
      }
    });
  }

  function stopClient() {
    if (state.client && state.client.ws) { try { state.client.ws.close(); } catch {} }
    state.client = null;
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
      if (state.client.projectId && project && project.id !== state.client.projectId) {
        return { ok: false, error: 'Project mismatch — only the shared session project can be synced' };
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
  ipcMain.handle('lan:startDiscovery', () => startDiscovery());
  ipcMain.handle('lan:stopDiscovery', () => { stopDiscovery(); return true; });
  ipcMain.handle('lan:pingHost', (_e, ip) => pingHost(ip));
  ipcMain.handle('lan:joinSession', (_e, creds) => joinSession(creds || {}));
  ipcMain.handle('lan:disconnectSession', () => { stopClient(); return true; });
  ipcMain.handle('lan:sendAction', (_e, payload) => applyPublish(payload));
};