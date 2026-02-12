import { Server, Socket } from 'socket.io';
import { 
  SocketEvent, 
  joinBoardPayloadSchema, 
  leaveBoardPayloadSchema,
  sendChatMessagePayloadSchema,
} from '@collabboard/shared';
import { verifyAccessToken } from '../utils/auth';
import { query } from '../db/client';
import { logger } from '../utils/logger';
import { activeWebSocketConnections } from '../utils/metrics';
import { addUserPresence, removeUserPresence, getBoardPresence } from './presence';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  email?: string;
}

async function checkBoardAccess(userId: string, boardId: string): Promise<boolean> {
  const result = await query(
    `SELECT b.id 
     FROM boards b
     JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
     WHERE b.id = $1 AND wm.user_id = $2`,
    [boardId, userId]
  );
  
  return result.rows.length > 0;
}

export function setupSocketHandlers(io: Server) {
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token missing'));
      }
      
      const payload = verifyAccessToken(token);
      
      // Get user name
      const userResult = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [payload.userId]
      );
      
      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }
      
      socket.userId = payload.userId;
      socket.userName = userResult.rows[0].name;
      socket.email = userResult.rows[0].email;
      
      next();
    } catch (error) {
      logger.error({ error }, 'Socket authentication failed');
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ userId: socket.userId, socketId: socket.id }, 'Client connected');
    
    activeWebSocketConnections.inc();
    
    // Join board
    socket.on(SocketEvent.JOIN_BOARD, async (data) => {
      try {
        const payload = joinBoardPayloadSchema.parse(data);
        
        // Check board access
        const hasAccess = await checkBoardAccess(socket.userId!, payload.boardId);
        
        if (!hasAccess) {
          socket.emit(SocketEvent.ERROR, { message: 'No access to this board' });
          return;
        }
        
        // Join room
        await socket.join(`board:${payload.boardId}`);
        
        // Add presence
        await addUserPresence(payload.boardId, socket.userId!, socket.userName!);
        
        // Broadcast presence update
        const presence = await getBoardPresence(payload.boardId);
        io.to(`board:${payload.boardId}`).emit(SocketEvent.PRESENCE_UPDATE, {
          boardId: payload.boardId,
          users: presence,
        });
        
        // If lastEventId provided, send missed events
        if (payload.lastEventId !== undefined) {
          const eventsResult = await query(
            `SELECT event_id, type, payload, user_id, created_at 
             FROM board_events 
             WHERE board_id = $1 AND event_id > $2 
             ORDER BY event_id ASC 
             LIMIT 1000`,
            [payload.boardId, payload.lastEventId]
          );
          
          for (const event of eventsResult.rows) {
            socket.emit(event.type, {
              eventId: event.event_id,
              ...event.payload,
            });
          }
          
          logger.info({ 
            boardId: payload.boardId, 
            userId: socket.userId, 
            missedEvents: eventsResult.rows.length 
          }, 'Replayed missed events');
        }
        
        logger.info({ boardId: payload.boardId, userId: socket.userId }, 'User joined board');
      } catch (error: any) {
        logger.error({ error }, 'Join board error');
        socket.emit(SocketEvent.ERROR, { 
          message: error.name === 'ZodError' ? 'Invalid payload' : 'Failed to join board' 
        });
      }
    });
    
    // Leave board
    socket.on(SocketEvent.LEAVE_BOARD, async (data) => {
      try {
        const payload = leaveBoardPayloadSchema.parse(data);
        
        // Leave room
        await socket.leave(`board:${payload.boardId}`);
        
        // Remove presence
        await removeUserPresence(payload.boardId, socket.userId!);
        
        // Broadcast presence update
        const presence = await getBoardPresence(payload.boardId);
        io.to(`board:${payload.boardId}`).emit(SocketEvent.PRESENCE_UPDATE, {
          boardId: payload.boardId,
          users: presence,
        });
        
        logger.info({ boardId: payload.boardId, userId: socket.userId }, 'User left board');
      } catch (error: any) {
        logger.error({ error }, 'Leave board error');
        socket.emit(SocketEvent.ERROR, { 
          message: error.name === 'ZodError' ? 'Invalid payload' : 'Failed to leave board' 
        });
      }
    });
    
    // Send chat message
    socket.on(SocketEvent.SEND_CHAT_MESSAGE, async (data) => {
      try {
        const payload = sendChatMessagePayloadSchema.parse(data);
        
        // Check board access
        const hasAccess = await checkBoardAccess(socket.userId!, payload.boardId);
        
        if (!hasAccess) {
          socket.emit(SocketEvent.ERROR, { message: 'No access to this board' });
          return;
        }
        
        // Broadcast chat message
        const chatMessage = {
          id: crypto.randomUUID(),
          boardId: payload.boardId,
          userId: socket.userId!,
          userName: socket.userName!,
          message: payload.message,
          createdAt: new Date().toISOString(),
        };
        
        io.to(`board:${payload.boardId}`).emit(SocketEvent.CHAT_MESSAGE, chatMessage);
        
        logger.debug({ boardId: payload.boardId, userId: socket.userId }, 'Chat message sent');
      } catch (error: any) {
        logger.error({ error }, 'Send chat message error');
        socket.emit(SocketEvent.ERROR, { 
          message: error.name === 'ZodError' ? 'Invalid payload' : 'Failed to send message' 
        });
      }
    });
    
    // Disconnect
    socket.on('disconnect', async () => {
      logger.info({ userId: socket.userId, socketId: socket.id }, 'Client disconnected');
      
      activeWebSocketConnections.dec();
      
      // Clean up presence from all boards
      // In a real app, track which boards the user was in
    });
  });
}
