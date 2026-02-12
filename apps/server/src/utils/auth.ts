import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config';
import type { JWTPayload } from '@collabboard/shared';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry,
  });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry,
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
