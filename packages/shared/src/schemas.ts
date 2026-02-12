import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export const inviteToWorkspaceSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
});

// Board schemas
export const createBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const getBoardEventsSchema = z.object({
  afterEventId: z.string().transform(Number).optional(),
});

// Column schemas
export const createColumnSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const renameColumnSchema = z.object({
  name: z.string().min(1).max(100),
});

// Card schemas
export const createCardSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  version: z.number().int().min(0),
});

export const moveCardSchema = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().min(0),
  version: z.number().int().min(0),
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteToWorkspaceInput = z.infer<typeof inviteToWorkspaceSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type GetBoardEventsQuery = z.infer<typeof getBoardEventsSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type RenameColumnInput = z.infer<typeof renameColumnSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
