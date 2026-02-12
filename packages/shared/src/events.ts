import { z } from 'zod';

// Socket event types
export enum SocketEvent {
  // Client -> Server
  JOIN_BOARD = 'join_board',
  LEAVE_BOARD = 'leave_board',
  SEND_CHAT_MESSAGE = 'send_chat_message',
  
  // Server -> Client
  CARD_CREATED = 'card_created',
  CARD_UPDATED = 'card_updated',
  CARD_MOVED = 'card_moved',
  CARD_DELETED = 'card_deleted',
  COLUMN_CREATED = 'column_created',
  COLUMN_RENAMED = 'column_renamed',
  COLUMN_DELETED = 'column_deleted',
  CHAT_MESSAGE = 'chat_message',
  PRESENCE_UPDATE = 'presence_update',
  SYNC_REQUIRED = 'sync_required',
  ERROR = 'error',
}

// Event payload schemas
export const joinBoardPayloadSchema = z.object({
  boardId: z.string().uuid(),
  lastEventId: z.number().int().min(0).optional(),
});

export const leaveBoardPayloadSchema = z.object({
  boardId: z.string().uuid(),
});

export const sendChatMessagePayloadSchema = z.object({
  boardId: z.string().uuid(),
  message: z.string().min(1).max(1000),
});

// Server -> Client event payloads
export interface CardCreatedPayload {
  eventId: number;
  card: {
    id: string;
    boardId: string;
    columnId: string;
    title: string;
    description: string | null;
    tags: string[];
    position: number;
    version: number;
    createdBy: string;
    updatedBy: string;
    createdAt: string;
    updatedAt: string;
  };
  userId: string;
}

export interface CardUpdatedPayload {
  eventId: number;
  cardId: string;
  boardId: string;
  updates: {
    title?: string;
    description?: string | null;
    tags?: string[];
    version: number;
    updatedBy: string;
    updatedAt: string;
  };
  userId: string;
}

export interface CardMovedPayload {
  eventId: number;
  cardId: string;
  boardId: string;
  columnId: string;
  position: number;
  version: number;
  userId: string;
}

export interface CardDeletedPayload {
  eventId: number;
  cardId: string;
  boardId: string;
  userId: string;
}

export interface ColumnCreatedPayload {
  eventId: number;
  column: {
    id: string;
    boardId: string;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  };
  userId: string;
}

export interface ColumnRenamedPayload {
  eventId: number;
  columnId: string;
  boardId: string;
  name: string;
  userId: string;
}

export interface ColumnDeletedPayload {
  eventId: number;
  columnId: string;
  boardId: string;
  userId: string;
}

export interface ChatMessagePayload {
  id: string;
  boardId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface PresenceUpdatePayload {
  boardId: string;
  users: Array<{
    userId: string;
    userName: string;
    joinedAt: number;
  }>;
}

export interface SyncRequiredPayload {
  boardId: string;
  reason: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// Type exports
export type JoinBoardPayload = z.infer<typeof joinBoardPayloadSchema>;
export type LeaveBoardPayload = z.infer<typeof leaveBoardPayloadSchema>;
export type SendChatMessagePayload = z.infer<typeof sendChatMessagePayloadSchema>;
