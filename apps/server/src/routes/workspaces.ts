import { FastifyInstance } from 'fastify';
import { createWorkspaceSchema, inviteToWorkspaceSchema } from '@collabboard/shared';
import { query } from '../db/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkWorkspaceRole } from '../middleware/rbac';
import { logger } from '../utils/logger';

export async function workspaceRoutes(fastify: FastifyInstance) {
  // Get all workspaces for current user
  fastify.get('/workspaces', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const result = await query(
        `SELECT w.id, w.name, w.created_at, wm.role 
         FROM workspaces w
         JOIN workspace_members wm ON w.id = wm.workspace_id
         WHERE wm.user_id = $1
         ORDER BY w.created_at DESC`,
        [request.user!.userId]
      );
      
      return { workspaces: result.rows };
    } catch (error) {
      logger.error({ error }, 'Get workspaces error');
      return reply.status(500).send({ error: 'Failed to fetch workspaces' });
    }
  });
  
  // Create workspace
  fastify.post('/workspaces', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const body = createWorkspaceSchema.parse(request.body);
      
      // Create workspace
      const workspaceResult = await query(
        `INSERT INTO workspaces (name, created_by) 
         VALUES ($1, $2) 
         RETURNING id, name, created_at`,
        [body.name, request.user!.userId]
      );
      
      const workspace = workspaceResult.rows[0];
      
      // Add creator as OWNER
      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) 
         VALUES ($1, $2, $3)`,
        [workspace.id, request.user!.userId, 'OWNER']
      );
      
      logger.info({ workspaceId: workspace.id, userId: request.user!.userId }, 'Workspace created');
      
      return { workspace };
    } catch (error: any) {
      logger.error({ error }, 'Create workspace error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to create workspace' });
    }
  });
  
  // Invite user to workspace (stub - in production, send email)
  fastify.post('/workspaces/:id/invite', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = inviteToWorkspaceSchema.parse(request.body);
      
      // Check if user has ADMIN or OWNER role
      const hasPermission = await checkWorkspaceRole(
        request,
        reply,
        id,
        ['OWNER', 'ADMIN']
      );
      
      if (!hasPermission) return;
      
      // Find user by email
      const userResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [body.email]
      );
      
      if (userResult.rows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }
      
      const invitedUserId = userResult.rows[0].id;
      
      // Check if already a member
      const memberCheck = await query(
        `SELECT id FROM workspace_members 
         WHERE workspace_id = $1 AND user_id = $2`,
        [id, invitedUserId]
      );
      
      if (memberCheck.rows.length > 0) {
        return reply.status(409).send({ error: 'User already a member' });
      }
      
      // Add member
      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) 
         VALUES ($1, $2, $3)`,
        [id, invitedUserId, body.role]
      );
      
      logger.info({ workspaceId: id, invitedUserId }, 'User invited to workspace');
      
      return { message: 'User invited successfully' };
    } catch (error: any) {
      logger.error({ error }, 'Invite user error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to invite user' });
    }
  });
}
