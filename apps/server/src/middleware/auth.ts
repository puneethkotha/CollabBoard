import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../utils/auth';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    email: string;
  };
}

export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    
    request.user = {
      userId: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    logger.warn({ error }, 'Authentication failed');
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
