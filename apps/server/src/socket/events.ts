import { Server } from 'socket.io';
import { query } from '../db/client';
import { logger } from '../utils/logger';
import { boardEventCounter } from '../utils/metrics';

let io: Server;

export function setSocketServer(socketServer: Server) {
  io = socketServer;
}

export async function emitBoardEvent(
  boardId: string,
  eventType: string,
  payload: any
): Promise<void> {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return;
  }
  
  try {
    // Insert event into database
    const result = await query(
      `INSERT INTO board_events (board_id, type, payload, user_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING event_id`,
      [boardId, eventType, JSON.stringify(payload), payload.userId]
    );
    
    const eventId = result.rows[0].event_id;
    
    // Update payload with actual event ID
    const eventPayload = { ...payload, eventId };
    
    // Broadcast to all clients in the board room
    io.to(`board:${boardId}`).emit(eventType, eventPayload);
    
    // Update metrics
    boardEventCounter.inc({ event_type: eventType });
    
    logger.debug({ boardId, eventType, eventId }, 'Board event emitted');
  } catch (error) {
    logger.error({ error, boardId, eventType }, 'Failed to emit board event');
  }
}
