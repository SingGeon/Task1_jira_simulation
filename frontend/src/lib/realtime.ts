import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

function ensureSocket(): Socket {
  if (socket) return socket;
  socket = io({ path: '/socket.io', auth: { token: getToken() ?? '' } });
  return socket;
}

/** Call on logout so the next connection picks up the new session's token. */
export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

/** Joins the project's live room and calls onChanged whenever anything about it changes server-side. */
export function useProjectRealtime(projectId: string | undefined, onChanged: () => void) {
  const callback = useRef(onChanged);
  callback.current = onChanged;

  useEffect(() => {
    if (!projectId) return;
    const s = ensureSocket();
    const handleChanged = () => callback.current();
    s.on('changed', handleChanged);
    s.emit('join', { projectId });
    return () => {
      s.off('changed', handleChanged);
      s.emit('leave', { projectId });
    };
  }, [projectId]);
}
