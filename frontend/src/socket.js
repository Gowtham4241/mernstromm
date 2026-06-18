import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (userId, role) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket.io Client] Connected. Emitting join_room with ID:', userId);
    socket?.emit('join_room', { userId, role });
  });

  socket.on('reconnect', (attempt) => {
    console.log('[Socket.io Client] Reconnected after', attempt, 'attempt(s). Rejoining room.');
    socket?.emit('join_room', { userId, role });
  });

  socket.on('disconnect', () => {
    console.log('[Socket.io Client] Disconnected.');
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
