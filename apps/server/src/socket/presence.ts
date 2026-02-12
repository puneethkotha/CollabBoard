import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import type { PresenceUser } from '@collabboard/shared';

const PRESENCE_TTL = 300; // 5 minutes

export async function addUserPresence(
  boardId: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    const key = `presence:${boardId}`;
    const presenceData: PresenceUser = {
      userId,
      userName,
      joinedAt: Date.now(),
    };
    
    await redisClient.hSet(key, userId, JSON.stringify(presenceData));
    await redisClient.expire(key, PRESENCE_TTL);
    
    logger.debug({ boardId, userId }, 'User presence added');
  } catch (error) {
    logger.error({ error, boardId, userId }, 'Failed to add user presence');
  }
}

export async function removeUserPresence(
  boardId: string,
  userId: string
): Promise<void> {
  try {
    const key = `presence:${boardId}`;
    await redisClient.hDel(key, userId);
    
    logger.debug({ boardId, userId }, 'User presence removed');
  } catch (error) {
    logger.error({ error, boardId, userId }, 'Failed to remove user presence');
  }
}

export async function getBoardPresence(boardId: string): Promise<PresenceUser[]> {
  try {
    const key = `presence:${boardId}`;
    const data = await redisClient.hGetAll(key);
    
    const users: PresenceUser[] = Object.values(data).map(str => JSON.parse(str));
    
    return users;
  } catch (error) {
    logger.error({ error, boardId }, 'Failed to get board presence');
    return [];
  }
}

export async function updatePresenceHeartbeat(
  boardId: string,
  userId: string
): Promise<void> {
  try {
    const key = `presence:${boardId}`;
    const userData = await redisClient.hGet(key, userId);
    
    if (userData) {
      const presence: PresenceUser = JSON.parse(userData);
      // Keep the original joinedAt time
      await redisClient.hSet(key, userId, JSON.stringify(presence));
      await redisClient.expire(key, PRESENCE_TTL);
    }
  } catch (error) {
    logger.error({ error, boardId, userId }, 'Failed to update presence heartbeat');
  }
}
