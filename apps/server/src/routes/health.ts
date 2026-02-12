import { FastifyInstance } from 'fastify';
import { query } from '../db/client';
import { redisClient } from '../utils/redis';
import { register } from '../utils/metrics';

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/health', async (request, reply) => {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'unknown',
        redis: 'unknown',
      },
    };
    
    // Check database
    try {
      await query('SELECT 1');
      health.checks.database = 'healthy';
    } catch (error) {
      health.checks.database = 'unhealthy';
      health.status = 'unhealthy';
    }
    
    // Check Redis
    try {
      await redisClient.ping();
      health.checks.redis = 'healthy';
    } catch (error) {
      health.checks.redis = 'unhealthy';
      health.status = 'unhealthy';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });
  
  // Metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
