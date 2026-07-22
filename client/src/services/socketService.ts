import { io } from 'socket.io-client';
import { API_BASE } from '../config/api';

export const socket = io(API_BASE, {
  withCredentials: true,
  autoConnect: false,
});

export function connectSocket(): void {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  socket.disconnect();
}
