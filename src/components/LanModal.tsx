import React, { useEffect, useState } from 'react';
import { LanHostInfo, LanSessionState, LanSyncProgress } from '../global';

interface Props {
  session: LanSessionState | null;
  hosts: LanHostInfo[];
  sync: LanSyncProgress | null;
  joining: boolean;
  myName: string;
  onMyNameChange: (name: string) => void;
  onStartHost: (hostName: string, password: string) => Promise<void>;
  onStopHost: () => Promise<void>;
  onJoin: (host: LanHostInfo, password: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onClose: () => void;
}

export default function LanModal({
  session, hosts, sync, joining, myName,
  onMyNameChange, onStartHost, onStopHost, onJoin, onDisconnect, onClose
}: Props) {
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [requirePassword, setRequirePassword] = useState(true);
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<LanHostInfo | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [pinging, setPinging] = useState(false);
  const [starting, setStarting] = useState(false);

  const busy = joining || starting;
  const syncing = !!sync && (sync.phase === 'connect' || sync.phase === 'auth' || sync.phase === 'sync');

  useEffect(() => {
    window.qv.lan.startDiscovery().then(() => {});
    return () => { window.qv.lan.stopDiscovery().then(() => {}); };
  }, []);

  const hostActive = session?.role === 'host';
  const clientActive = session?.role === 'client';

  async function doStartHost() {
    setStarting(true);
    await onStartHost(myName.trim() || 'Coder', requirePassword ? password : '');
    setStarting(false);
  }

  async function doJoin() {
    if (!selected) return;
    await onJoin(selected, joinPassword);
    setJoinPassword('');
  }

  async function doPing() {
    const ip = manualIp.trim();
    if (!ip) return;
    setPinging(true);
    try {
      await window.qv.lan.pingHost(ip);
      setTimeout(() => setPinging(false), 2500);
    } catch {
      setPinging(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, fontFamily: 'inherit' }}>
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)' }}
        onClick={() => { if (!busy) onClose(); }}
      />

      <div className="modal" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 480, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
        backgroundColor: '#ffffff', color: '#0f172a', padding: '20px', borderRadius: '10px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>🌐 LAN Collaboration</h3>
          <button className="icon-btn" onClick={onClose} disabled={busy} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="mini-btn"
            style={{ flex: 1, padding: '6px', fontWeight: tab === 'host' ? 'bold' : 'normal', border: tab === 'host' ? '2px solid #3b82f6' : '1px solid #cbd5e1' }}
            onClick={() => setTab('host')}
            disabled={busy}
          >
            🖥️ Host a Session
          </button>
          <button
            className="mini-btn"
            style={{ flex: 1, padding: '6px', fontWeight: tab === 'join' ? 'bold' : 'normal', border: tab === 'join' ? '2px solid #3b82f6' : '1px solid #cbd5e1' }}
            onClick={() => setTab('join')}
            disabled={busy}
          >
            📡 Join a Session
          </button>
        </div>

        {tab === 'host' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Your name (shown to joiners)</label>
              <input
                value={myName}
                onChange={e => onMyNameChange(e.target.value)}
                placeholder="e.g. Anisur (Coder 1)"
                disabled={busy || hostActive}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'bold', marginBottom: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requirePassword}
                  onChange={e => { setRequirePassword(e.target.checked); if (!e.target.checked) setPassword(''); }}
                  disabled={busy || hostActive}
                />
                Require a session password
              </label>
              {requirePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Session password"
                  disabled={busy || hostActive}
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontSize: 13 }}
                />
              )}
            </div>

            {hostActive && session ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#166534' }}>● Hosting — port 8080</div>
                <div style={{ fontSize: 12, color: '#14532d' }}>
                  {session.coders.filter(c => c.source === 'client').length} connected coder(s) — live synced
                </div>
                <div style={{ fontSize: 12 }}>
                  {session.coders.map((c, i) => (
                    <span key={i} style={{ display: 'inline-block', backgroundColor: '#bbf7d0', color: '#14532d', borderRadius: 10, padding: '2px 8px', margin: '2px 4px 0 0' }}>
                      {c.source === 'host' ? '🖥️' : '👤'} {c.coderName}
                    </span>
                  ))}
                </div>
                <button className="mini-btn" style={{ alignSelf: 'flex-start', padding: '6px 12px', color: '#991b1b', borderColor: '#fecaca' }} onClick={onStopHost} disabled={busy}>⏹ Stop Session</button>
              </div>
            ) : (
              <button className="primary-btn" onClick={doStartHost} disabled={busy || !myName.trim()}>
                {starting ? 'Starting…' : '▶ Start Hosting'}
              </button>
            )}
          </div>
        )}

        {tab === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clientActive && session ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1e40af' }}>● Connected to {session.myName}'s session</div>
                <div style={{ fontSize: 12 }}>
                  {session.coders.map((c, i) => (
                    <span key={i} style={{ display: 'inline-block', backgroundColor: '#bfdbfe', color: '#1e40af', borderRadius: 10, padding: '2px 8px', margin: '2px 4px 0 0' }}>
                      {c.source === 'host' ? '🖥️' : '👤'} {c.coderName}
                    </span>
                  ))}
                </div>
                <button className="mini-btn" style={{ alignSelf: 'flex-start', padding: '6px 12px', color: '#991b1b', borderColor: '#fecaca' }} onClick={onDisconnect} disabled={busy}>⏹ Disconnect</button>
              </div>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>Your name (shown to the host)</label>
                  <input
                    value={myName}
                    onChange={e => onMyNameChange(e.target.value)}
                    placeholder="e.g. Coder 2"
                    disabled={busy}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontSize: 13 }}
                  />
                </div>

                <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, backgroundColor: hosts.length > 0 ? '#22c55e' : '#94a3b8', animation: 'none' }} />
                  {hosts.length > 0 ? `${hosts.length} host(s) found on this network` : 'Scanning for hosts on this network…'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 6 }}>
                  {hosts.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', padding: '10px 4px' }}>No active sessions found. Make sure a host is running on the same Wi-Fi/network.</div>}
                  {hosts.map(h => {
                    const isSelected = selected?.ip === h.ip && selected?.wsPort === h.wsPort;
                    return (
                      <button
                        key={`${h.ip}:${h.wsPort}`}
                        onClick={() => { setSelected(h); setJoinPassword(''); }}
                        style={{
                          textAlign: 'left', padding: '10px', borderRadius: 6, cursor: 'pointer',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff', fontSize: 13
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>
                          {h.requiresPassword ? '🔒 ' : '👤 '}{h.hostName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{h.projectName} · {h.ip}:{h.wsPort}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={manualIp}
                    onChange={e => setManualIp(e.target.value)}
                    placeholder="Host IP (e.g. 192.168.1.24)"
                    onKeyDown={e => { if (e.key === 'Enter') doPing(); }}
                    style={{ flex: 1, padding: '8px', boxSizing: 'border-box', fontSize: 13 }}
                  />
                  <button className="mini-btn" onClick={doPing} disabled={pinging || !manualIp.trim()} style={{ padding: '8px 12px' }}>
                    {pinging ? 'Searching…' : '🔍 Find by IP'}
                  </button>
                </div>
                {pinging && <div style={{ fontSize: 11, color: '#64748b' }}>Sent a request to {manualIp.trim()} — if a host is listening it will appear in the list above.</div>}

                {selected && !clientActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold' }}>Join “{selected.hostName}”</div>
                    {selected.requiresPassword && (
                      <input
                        type="password"
                        value={joinPassword}
                        onChange={e => setJoinPassword(e.target.value)}
                        placeholder="Session password"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontSize: 13 }}
                      />
                    )}
                    <button className="primary-btn" onClick={doJoin} disabled={busy || (selected.requiresPassword && !joinPassword)}>
                      {joining ? 'Joining…' : '🔗 Join Session'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {(syncing || joining) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '24px 32px', borderRadius: 10, minWidth: 360, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>Downloading Host Project Data…</div>
            <div style={{ height: 14, backgroundColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (sync?.percent ?? 0)))}%`, backgroundColor: '#3b82f6', transition: 'width 0.2s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              {sync ? `${Math.round(sync.percent)}%` : 'Waiting for host…'}{sync?.total ? ` — chunk ${sync.received ?? 0}/${sync.total}` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}