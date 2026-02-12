import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshTokenSchema } from '@collabboard/shared';
import { query, transaction } from '../db/client';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, hashToken, verifyRefreshToken } from '../utils/auth';
import { logger } from '../utils/logger';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/auth/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      // Check if user exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [body.email]
      );
      
      if (existingUser.rows.length > 0) {
        return reply.status(409).send({ error: 'User already exists' });
      }
      
      // Hash password and create user
      const passwordHash = await hashPassword(body.password);
      
      const result = await query(
        `INSERT INTO users (email, password_hash, name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, name, created_at`,
        [body.email, passwordHash, body.name]
      );
      
      const user = result.rows[0];
      
      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });
      
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
      });
      
      // Store refresh token hash
      const tokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      
      logger.info({ userId: user.id }, 'User registered');
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      logger.error({ error }, 'Registration error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });
  
  // Login
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Find user
      const result = await query(
        'SELECT id, email, name, password_hash FROM users WHERE email = $1',
        [body.email]
      );
      
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      
      const user = result.rows[0];
      
      // Verify password
      const isValid = await verifyPassword(body.password, user.password_hash);
      
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      
      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
      });
      
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
      });
      
      // Store refresh token hash
      const tokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      
      logger.info({ userId: user.id }, 'User logged in');
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      logger.error({ error }, 'Login error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Login failed' });
    }
  });
  
  // Refresh token
  fastify.post('/auth/refresh', async (request, reply) => {
    try {
      const body = refreshTokenSchema.parse(request.body);
      
      // Verify refresh token
      let payload;
      try {
        payload = verifyRefreshToken(body.refreshToken);
      } catch (error) {
        return reply.status(401).send({ error: 'Invalid refresh token' });
      }
      
      // Check if token exists in database
      const tokenHash = hashToken(body.refreshToken);
      const result = await query(
        `SELECT id, user_id FROM refresh_tokens 
         WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
      );
      
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Refresh token not found or expired' });
      }
      
      // Delete old refresh token (rotation)
      await query('DELETE FROM refresh_tokens WHERE id = $1', [result.rows[0].id]);
      
      // Generate new tokens
      const accessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
      });
      
      const newRefreshToken = generateRefreshToken({
        userId: payload.userId,
        email: payload.email,
      });
      
      // Store new refresh token hash
      const newTokenHash = hashToken(newRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
         VALUES ($1, $2, $3)`,
        [payload.userId, newTokenHash, expiresAt]
      );
      
      logger.info({ userId: payload.userId }, 'Token refreshed');
      
      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error: any) {
      logger.error({ error }, 'Refresh token error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Token refresh failed' });
    }
  });
  
  // Logout
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      const body = refreshTokenSchema.parse(request.body);
      
      // Delete refresh token
      const tokenHash = hashToken(body.refreshToken);
      await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      
      logger.info('User logged out');
      
      return { message: 'Logged out successfully' };
    } catch (error: any) {
      logger.error({ error }, 'Logout error');
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      
      return reply.status(500).send({ error: 'Logout failed' });
    }
  });
}
