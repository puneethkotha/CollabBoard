export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  joinedAt: Date;
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardEvent {
  id: string;
  boardId: string;
  eventId: number;
  type: string;
  payload: any;
  userId: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  boardId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Date;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  joinedAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}
