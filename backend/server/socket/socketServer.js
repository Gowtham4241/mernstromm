import { Server } from 'socket.io';
import { db } from '../db.js';

let io = null;

// Track online users in-memory by userId
// Maps userId -> Set of socket.ids (to handle multiple tabs correctly)
export const onlineUsers = new Map();

export function initSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow connections from any origin
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join room & Set up user session metadata
    socket.on('join_room', (data) => {
      const { userId, role } = data;
      if (!userId) {
        console.warn('[Socket.io] join_room received without userId');
        return;
      }

      socket.userId = userId;
      socket.userRole = role === 'mechanic' ? 'mechanic' : 'user';

      // Join room specified by specification:
      // user_<userId> or mechanic_<mechanicId>
      const roomName = socket.userRole === 'mechanic' ? `mechanic_${userId}` : `user_${userId}`;
      socket.join(roomName);

      // Add to online tracking
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      console.log(`[Socket.io] User ${userId} (${role}) joined room: ${roomName}`);

      // Broadcast updated online presence
      io?.emit('user_status_change', {
        userId,
        status: 'online',
        onlineUsers: getOnlineUsersList(),
      });

      // Confirm join
      socket.emit('room_joined', {
        roomName,
        onlineUsers: getOnlineUsersList(),
      });
    });

    // Real-time Messaging
    socket.on('send_message', async (data) => {
      const { chatId, senderId, senderRole, receiverId, message } = data;

      if (!chatId || !senderId || !receiverId || !message) {
        console.warn('[Socket.io] send_message contains invalid fields:', data);
        socket.emit('error', { message: 'Failed to process message. Missing required fields.' });
        return;
      }

      const cleanMessage = message.trim();
      const nowIso = new Date().toISOString();
      const msgId = 'msg_' + Math.random().toString(36).substring(2, 11);

      try {
        // 1. Verify chat exists or create one if needed
        let chat = db.chats.findById(chatId);
        if (!chat) {
          // Fallback chat creation
          chat = db.chats.create({
            id: chatId,
            participants: [senderId, receiverId],
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        } else {
          db.chats.update(chatId, { updatedAt: nowIso });
        }

        // 2. Save Message in MongoDB
        const newMsg = db.messages.create({
          id: msgId,
          chatId,
          senderId,
          senderRole: senderRole === 'mechanic' ? 'mechanic' : 'user',
          receiverId,
          message: cleanMessage,
          timestamp: nowIso,
          isRead: false,
        });

        // 3. Create Persistent Notification
        let notificationMsg = '';
        if (senderRole === 'mechanic') {
          notificationMsg = "Mechanic replied to your request";
        } else {
          notificationMsg = "New customer message received";
        }

        const np = db.notifications.create({
          id: 'ntf_' + Math.random().toString(36).substring(2, 11),
          userId: receiverId,
          message: notificationMsg,
          isRead: false,
          createdAt: nowIso,
        });

        // 4. Emit to Receiver Room
        const receiverRoom = senderRole === 'mechanic' ? `user_${receiverId}` : `mechanic_${receiverId}`;
        io?.to(receiverRoom).emit('receive_message', newMsg);

        // Also emit notification
        io?.to(receiverRoom).emit('new_notification', np);

        // 5. Echo back to sender's exact room or socket instance for sync confirmation
        socket.emit('message_sent_confirm', newMsg);

        console.log(`[Socket.io] Msg ${msgId} relayed from ${senderId} to ${receiverId} (Room: ${receiverRoom})`);
      } catch (err) {
        console.error('[Socket.io] Error processing send_message:', err);
        socket.emit('error', { message: 'Db error saving message.' });
      }
    });

    // Message Read status synchronization
    socket.on('message_read', (data) => {
      const { chatId, messageId, readerId } = data;
      if (!chatId) return;

      try {
        if (messageId) {
          db.messages.update(messageId, { isRead: true });
        } else {
          // Read all unread messages in this chat for the reader
          const unread = db.messages.find(m => m.chatId === chatId && m.receiverId === readerId && !m.isRead);
          unread.forEach(m => {
            db.messages.update(m.id, { isRead: true });
          });
        }

        // Broadcast event to chat participants
        const chat = db.chats.findById(chatId);
        if (chat) {
          chat.participants.forEach((pId) => {
            if (pId !== readerId) {
              const uRoom = `user_${pId}`;
              const mRoom = `mechanic_${pId}`;
              io?.to(uRoom).to(mRoom).emit('messages_marked_read', { chatId, readerId });
            }
          });
        }
      } catch (err) {
        console.error('[Socket.io] Error in message_read handler:', err);
      }
    });

    // Real-time typing indicators
    socket.on('typing', (data) => {
      const { chatId, senderId, receiverId } = data;
      const receiverUserRoom = `user_${receiverId}`;
      const receiverMecRoom = `mechanic_${receiverId}`;
      io?.to(receiverUserRoom).to(receiverMecRoom).emit('typing', { chatId, senderId });
    });

    socket.on('stop_typing', (data) => {
      const { chatId, senderId, receiverId } = data;
      const receiverUserRoom = `user_${receiverId}`;
      const receiverMecRoom = `mechanic_${receiverId}`;
      io?.to(receiverUserRoom).to(receiverMecRoom).emit('stop_typing', { chatId, senderId });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      const userId = socket.userId;

      if (userId) {
        const userSet = onlineUsers.get(userId);
        if (userSet) {
          userSet.delete(socket.id);
          if (userSet.size === 0) {
            onlineUsers.delete(userId);
            // Broadcast offline state change
            io?.emit('user_status_change', {
              userId,
              status: 'offline',
              onlineUsers: getOnlineUsersList(),
            });
            console.log(`[Socket.io] User ${userId} is now completely OFFLINE`);
          }
        }
      }
    });
  });

  return io;
}

// Access layer for REST api route triggers to push notifications or sync in real-time
export function getSocketIo() {
  return io;
}

export function getOnlineUsersList() {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

// Send real-time notification to a user or mechanic via HTTP events
export function sendRealtimeNotification(userId, notification) {
  if (!io) return;
  const userRoom = `user_${userId}`;
  const mecRoom = `mechanic_${userId}`;
  io.to(userRoom).to(mecRoom).emit('new_notification', notification);
}

// Send real-time packet message created via REST endpoint
export function broadcastRestMessage(receiverId, message) {
  if (!io) return;
  const userRoom = `user_${receiverId}`;
  const mecRoom = `mechanic_${receiverId}`;
  io.to(userRoom).to(mecRoom).emit('receive_message', message);
}
