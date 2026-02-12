import { FastifyInstance } from 'fastify';
import { createCardSchema, updateCardSchema, moveCardSchema } from '@collabboard/shared';
import { query } from '../db/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkBoardAccess } from '../middleware/rbac';
import { logger } from '../utils/logger';
import { emitBoardEvent } from '../socket/events';

export async function cardRoutes(fastify: FastifyInstance) {
  // Create card
  fastify.post('/boards/:boardId/cards', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const body = createCardSchema.parse(request.body);
      
      // Check board access
      const hasAccess = await checkBoardAccess(request, reply, boardId);
      if (!hasAccess) return;
      
      // Get next position in column
      const positionResult = await query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM cards WHERE column_id = $1',
        [body.columnId]
      );
      const position = positionResult.rows[0].next_position;
      
      // Create card
      const result = await query(
        `INSERT INTO cards (board_id, column_id, title, description, tags, position, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [boardId, body.columnId, body.title, body.description || null, body.tags, position, request.user!.userId, request.user!.userId]
      );
      
      const card = result.rows[0];
      
      // Emit event
      await emitBoardEvent(boardId, 'card_created', {
        eventId: 0, // Will be set by emitBoardEvent
        card: {
          ...card,
          createdAt: card.created_at.toISOString(),
          updatedAt: card.updated_at.toISOString(),
        },
        userId: request.user!.userId,
      });
      
      logger.info({ cardId: card.id, boardId, userId: request.user!.userId }, 'Card created');
      
      return { card };
    } catch (error: any) {
      logger.error({ error }, 'Create card error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to create card' });
    }
  });
  
  // Update card
  fastify.patch('/cards/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateCardSchema.parse(request.body);
      
      // Get card to check access and version
      const cardResult = await query(
        'SELECT board_id, version FROM cards WHERE id = $1',
        [id]
      );
      
      if (cardResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Card not found' });
      }
      
      const card = cardResult.rows[0];
      
      // Check board access
      const hasAccess = await checkBoardAccess(request, reply, card.board_id);
      if (!hasAccess) return;
      
      // Check version for optimistic concurrency
      if (card.version !== body.version) {
        return reply.status(409).send({ 
          error: 'Card version mismatch',
          currentVersion: card.version,
        });
      }
      
      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (body.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(body.title);
      }
      
      if (body.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(body.description);
      }
      
      if (body.tags !== undefined) {
        updates.push(`tags = $${paramIndex++}`);
        values.push(body.tags);
      }
      
      updates.push(`version = $${paramIndex++}`);
      values.push(body.version + 1);
      
      updates.push(`updated_by = $${paramIndex++}`);
      values.push(request.user!.userId);
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      values.push(id);
      
      // Update card
      const result = await query(
        `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      
      const updatedCard = result.rows[0];
      
      // Emit event
      const updatePayload: any = {
        version: updatedCard.version,
        updatedBy: request.user!.userId,
        updatedAt: updatedCard.updated_at.toISOString(),
      };
      
      if (body.title !== undefined) updatePayload.title = body.title;
      if (body.description !== undefined) updatePayload.description = body.description;
      if (body.tags !== undefined) updatePayload.tags = body.tags;
      
      await emitBoardEvent(card.board_id, 'card_updated', {
        eventId: 0,
        cardId: id,
        boardId: card.board_id,
        updates: updatePayload,
        userId: request.user!.userId,
      });
      
      logger.info({ cardId: id, boardId: card.board_id, userId: request.user!.userId }, 'Card updated');
      
      return { card: updatedCard };
    } catch (error: any) {
      logger.error({ error }, 'Update card error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to update card' });
    }
  });
  
  // Move card
  fastify.post('/cards/:id/move', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = moveCardSchema.parse(request.body);
      
      // Get card to check access and version
      const cardResult = await query(
        'SELECT board_id, version FROM cards WHERE id = $1',
        [id]
      );
      
      if (cardResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Card not found' });
      }
      
      const card = cardResult.rows[0];
      
      // Check board access
      const hasAccess = await checkBoardAccess(request, reply, card.board_id);
      if (!hasAccess) return;
      
      // Check version
      if (card.version !== body.version) {
        return reply.status(409).send({ 
          error: 'Card version mismatch',
          currentVersion: card.version,
        });
      }
      
      // Move card
      const result = await query(
        `UPDATE cards 
         SET column_id = $1, position = $2, version = version + 1, 
             updated_by = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING *`,
        [body.columnId, body.position, request.user!.userId, id]
      );
      
      const updatedCard = result.rows[0];
      
      // Emit event
      await emitBoardEvent(card.board_id, 'card_moved', {
        eventId: 0,
        cardId: id,
        boardId: card.board_id,
        columnId: body.columnId,
        position: body.position,
        version: updatedCard.version,
        userId: request.user!.userId,
      });
      
      logger.info({ cardId: id, boardId: card.board_id, userId: request.user!.userId }, 'Card moved');
      
      return { card: updatedCard };
    } catch (error: any) {
      logger.error({ error }, 'Move card error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Failed to move card' });
    }
  });
}
