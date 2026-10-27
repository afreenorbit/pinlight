import { useEffect, useRef, useState } from 'react';
import { apiBase, post } from '../lib/api.js';

const KEY = 'pinlight-arena-seat';
export const loadSeat = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; } };
export const saveSeat = seat => { try { seat ? sessionStorage.setItem(KEY, JSON.stringify(seat)) : sessionStorage.removeItem(KEY); } catch {} };

export const arenaApi = {
  create: input => post('/arena/rooms', input),
  join: (code, input) => post(`/arena/rooms/${encodeURIComponent(code)}/join`, input),
  start: seat => post(`/arena/rooms/${seat.code}/start`, { token: seat.token }),
  answer: (seat, body) => post(`/arena/rooms/${seat.code}/answer`, { token: seat.token, ...body }),
  leave: seat => post(`/arena/rooms/${seat.code}/leave`, { token: seat.token }),
  next: seat => post(`/arena/rooms/${seat.code}/next`, { token: seat.token }),
  retry: seat => post(`/arena/rooms/${seat.code}/retry`, { token: seat.token }),
};

// Live room state over server-sent events. The seat token is a random, room-scoped secret,
// so it can travel in the stream URL (EventSource cannot send headers).
export function useRoom(seat) {
  const [state, setState] = useState(null), [connection, setConnection] = useState('connecting'), offset = useRef(0);
  useEffect(() => {
    if (!seat) { setState(null); return; }
    let source, watchdog, heard = Date.now(), alive = true;
    // The server sends a heartbeat every 20 s. A proxy can keep a dead stream open, so silence
    // for 45 s means reconnect; a room that no longer exists then reports itself closed.
    const open = () => {
      source = new EventSource(`${apiBase}/arena/rooms/${seat.code}/events?token=${encodeURIComponent(seat.token)}`);
      source.onmessage = event => { heard = Date.now(); const next = JSON.parse(event.data); offset.current = next.serverNow - Date.now(); setState(next); setConnection('live'); };
      source.addEventListener('ping', () => { heard = Date.now(); });
      source.onerror = () => { if (alive) setConnection(source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting'); };
    };
    open();
    watchdog = setInterval(() => { if (Date.now() - heard > 45000 && source.readyState !== EventSource.CLOSED) { source.close(); heard = Date.now(); setConnection('reconnecting'); open(); } }, 5000);
    return () => { alive = false; clearInterval(watchdog); source.close(); };
  }, [seat?.code, seat?.token]);
  return { state, connection, serverNow: () => Date.now() + offset.current };
}

// Remaining seconds until the server's deadline, refreshed ten times a second.
export function useCountdown(deadline, serverNow) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, (deadline - serverNow()) / 1000));
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [deadline]);
  return left;
}
