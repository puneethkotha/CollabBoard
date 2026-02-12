import { FastifyInstance } from 'fastify';
import { createBoardSchema, getBoardEventsSchema } from '@collabboard/shared';
import { query } from '../db/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkWorkspaceMembership, checkBoardAccess } from '../middleware/rbac';
import { logger } from '../utils/logger';

export async function boardRoutes(fastify: FastifyInstance) {
  // Get all boards in workspace
  fastify.get('/boards', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { workspaceId } = request.query as { workspaceId?: string };
      
      if (!workspaceId) {
        return reply.status(400).send({ error: 'workspaceId query parameter required' });
      }
      
      // Check workspace membership
      const hasAccess = await checkWorkspaceMembership(request, reply, workspaceId);
      if (!hasAccess) return;
      
      const result = await query(
        `SELECT id, workspace_id, name, description, created_by, created_at, updated_at 
         FROM boards 
         WHERE workspace_id = $1 
         ORDER BY created_at DESC`,
        [workspaceId]
      );
      
      return { boards: result.rows };
    } catch (error) {
      logger.error({ error }, 'Get boards error');
      return reply.status(500).send({ error: 'Failed to fetch boards' });
    }
  });
  
  // Get single board with columns and cards
  fastify.get('/boards/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      // Check board access
      const hasAccess = await checkBoardAccess(request, reply, id);
      if (!hasAccess) return;
      
      // Get board
      const boardResult = await query(
        `SELECT id, workspace_id, name, description, created_by, created_at, updated_at 
         FROM boards 
         WHERE id = $1`,
        [id]
      );
      
      if (boardResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Board not found' });
      }
      
      const board = boardResult.rows[0];
      
      // Get columns
      const columnsResult = await query(
        `SELECT id, board_id, name, position, created_at, updated_at 
         FROM columns 
         WHERE board_id = $1 
         ORDER BY position`,
        [id]
      );
      
      // Get cards
      const cardsResult = await query(
        `SELECT id, board_id, column_id, title, description, tags, position, version, 
                created_by, updated_by, created_at, updated_at 
         FROM cards 
         WHERE board_id = $1 
         ORDER BY column_id, position`,
        [id]
      );
      
      return {
        board,
        columns: columnsResult.rows,
        cards: cardsResult.rows,
      };
    } catch (error) {
      logger.error({ error }, 'Get board error');
      return reply.status(500).send({ error: 'Failed to fetch board' });
    }
  });
  
  // Create board
  fastify.post('/boards', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const body = createBoardSchema.parse(request.body);
      
      // Check workspace membership
      const hasAccess = await checkWorkspaceMembership(request, reply, body.workspaceId);
      if (!hasAccess) return;
      
      // Create board
      const result = await query(
        `INSERT INTO boards (workspace_id, name, description, created_by) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, workspace_id, name, description, created_by, created_at, updated_at`,
        [body.workspaceId, body.name, body.description || null, request.user!.userId]
      );
      
      const board = result.rows[0];
      
      logger.info({ boardId: board.id, userId: request.user!.userId }, 'Board created');
      
      return { board };
    } catch (error: any) {
      logger.error({ error }, 'Create board error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to create board' });
    }
  });
  
  // Get board events (for sync/replay)
  fastify.get('/boards/:id/events', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const queryParams = getBoardEventsSchema.parse(request.query);
      
      // Check board access
      const hasAccess = await checkBoardAccess(request, reply, id);
      if (!hasAccess) return;
      
      let result;
      
      if (queryParams.afterEventId !== undefined) {
        // Get events after a specific event ID
        result = await query(
          `SELECT id, board_id, event_id, type, payload, user_id, created_at 
           FROM board_events 
           WHERE board_id = $1 AND event_id > $2 
           ORDER BY event_id ASC 
           LIMIT 1000`,
          [id, queryParams.afterEventId]
        );
      } else {
        // Get recent events
        result = await query(
          `SELECT id, board_id, event_id, type, payload, user_id, created_at 
           FROM board_events 
           WHERE board_id = $1 
           ORDER BY event_id DESC 
           LIMIT 100`,
          [id]
        );
      }
      
      return { events: result.rows };
    } catch (error: any) {
      logger.error({ error }, 'Get board events error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid query parameters', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to fetch board events' });
    }
  });
}
