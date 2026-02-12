import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth';
import { query } from '../db/client';
import type { UserRole } from '@collabboard/shared';

export async function checkWorkspaceMembership(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  workspaceId: string
): Promise<boolean> {
  const result = await query(
    `SELECT role FROM workspace_members 
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, request.user!.userId]
  );
  
  if (result.rows.length === 0) {
    reply.status(403).send({ error: 'Not a member of this workspace' });
    return false;
  }
  
  return true;
}

export async function checkWorkspaceRole(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  workspaceId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const result = await query(
    `SELECT role FROM workspace_members 
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, request.user!.userId]
  );
  
  if (result.rows.length === 0) {
    reply.status(403).send({ error: 'Not a member of this workspace' });
    return false;
  }
  
  const userRole = result.rows[0].role as UserRole;
  
  if (!requiredRoles.includes(userRole)) {
    reply.status(403).send({ error: 'Insufficient permissions' });
    return false;
  }
  
  return true;
}

export async function checkBoardAccess(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  boardId: string
): Promise<boolean> {
  const result = await query(
    `SELECT b.workspace_id 
     FROM boards b
     JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
     WHERE b.id = $1 AND wm.user_id = $2`,
    [boardId, request.user!.userId]
  );
  
  if (result.rows.length === 0) {
    reply.status(403).send({ error: 'No access to this board' });
    return false;
  }
  
  return true;
}
