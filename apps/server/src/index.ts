import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { config } from './config';
import { logger } from './utils/logger';
import { connectRedis, redisClient } from './utils/redis';
import { closePool } from './db/client';
import { authRoutes } from './routes/auth';
import { workspaceRoutes } from './routes/workspaces';
import { boardRoutes } from './routes/boards';
import { cardRoutes } from './routes/cards';
import { healthRoutes } from './routes/health';
import { setupSocketHandlers } from './socket/handlers';
import { setSocketServer } from './socket/events';
import { httpRequestDuration } from './utils/metrics';

async function start() {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');
    
    // Create Fastify instance
    const fastify = Fastify({
      logger: false, // Use pino logger instead
    });
    
    // Register CORS
    await fastify.register(cors, {
      origin: config.cors.origin,
      credentials: true,
    });
    
    // Register rate limiting
    await fastify.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
    });
    
    // Add request timing hook
    fastify.addHook('onRequest', async (request, reply) => {
      request.startTime = Date.now();
    });
    
    fastify.addHook('onResponse', async (request, reply) => {
      const duration = (Date.now() - (request as any).startTime) / 1000;
      httpRequestDuration.observe(
        {
          method: request.method,
          route: request.routerPath || 'unknown',
          status_code: reply.statusCode.toString(),
        },
        duration
      );
    });
    
    // Register routes
    await fastify.register(authRoutes);
    await fastify.register(workspaceRoutes);
    await fastify.register(boardRoutes);
    await fastify.register(cardRoutes);
    await fastify.register(healthRoutes);
    
    // Start HTTP server
    await fastify.listen({
      port: config.port,
      host: config.host,
    });
    
    logger.info(`HTTP server listening on ${config.host}:${config.port}`);
    
    // Create Socket.IO server with Redis adapter
    const io = new Server(fastify.server, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });
    
    // Set up Redis adapter for Socket.IO (for multi-instance scaling)
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    
    await pubClient.connect();
    await subClient.connect();
    
    io.adapter(createAdapter(pubClient, subClient));
    
    logger.info('Socket.IO Redis adapter configured');
    
    // Setup socket handlers
    setupSocketHandlers(io);
    setSocketServer(io);
    
    logger.info('Socket.IO server initialized');
    logger.info(`🚀 Server ready at http://${config.host}:${config.port}`);
    logger.info(`📊 Metrics: http://${config.host}:${config.port}/metrics`);
    logger.info(`❤️  Health: http://${config.host}:${config.port}/health`);
    
    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      
      await fastify.close();
      io.close();
      await closePool();
      await redisClient.quit();
      await pubClient.quit();
      await subClient.quit();
      
      logger.info('Server shut down gracefully');
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
