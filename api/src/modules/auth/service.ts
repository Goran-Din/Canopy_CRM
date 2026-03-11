import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { AuthUser } from './types.js';
import * as authRepo from './repository.js';

const SALT_ROUNDS = 12;

let _privateKey: string | null = null;
let _publicKey: string | null = null;

function getPrivateKey(): string {
  if (!_privateKey) {
    if (env.JWT_PRIVATE_KEY) {
      _privateKey = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else {
      _privateKey = readFileSync(
        resolve(env.JWT_PRIVATE_KEY_PATH || './keys/private.pem'),
        'utf-8',
      );
    }
  }
  return _privateKey;
}

function getPublicKey(): string {
  if (!_publicKey) {
    if (env.JWT_PUBLIC_KEY) {
      _publicKey = env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
    } else {
      _publicKey = readFileSync(
        resolve(env.JWT_PUBLIC_KEY_PATH || './keys/public.pem'),
        'utf-8',
      );
    }
  }
  return _publicKey;
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}

function createAccessToken(payload: AuthUser): string {
  return jwt.sign(
    {
      sub: payload.id,
      tenant_id: payload.tenant_id,
      email: payload.email,
      roles: payload.roles,
      divisions: payload.divisions,
    },
    getPrivateKey(),
    { algorithm: 'RS256', expiresIn: env.JWT_ACCESS_EXPIRY } as jwt.SignOptions,
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256'],
    }) as jwt.JwtPayload & { sub: string; tenant_id: string; email: string; roles: AuthUser['roles']; divisions?: string[] };
    return {
      id: decoded.sub,
      tenant_id: decoded.tenant_id,
      email: decoded.email,
      roles: decoded.roles,
      divisions: decoded.divisions || [],
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Token expired');
    }
    throw new AppError(401, 'Invalid token');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function login(email: string, password: string) {
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  if (!user.is_active) {
    throw new AppError(401, 'Account is deactivated');
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const roles = await authRepo.findUserRoles(user.id, user.tenant_id);

  const authUser: AuthUser = {
    id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    roles: roles.map((r) => ({ role: r.role_name, division_id: r.division_id })),
    divisions: [...new Set(roles.filter((r) => r.division_name).map((r) => r.division_name as string))],
  };

  const accessToken = createAccessToken(authUser);
  const refreshToken = generateRefreshToken();

  const refreshExpirySeconds = parseExpiry(env.JWT_REFRESH_EXPIRY);
  const expiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);

  await authRepo.saveRefreshToken(user.id, user.tenant_id, refreshToken, expiresAt);
  await authRepo.updateLastLogin(user.id);

  return {
    accessToken,
    refreshToken,
    refreshExpirySeconds,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      tenant_id: user.tenant_id,
      roles: authUser.roles,
    },
  };
}

export async function refresh(refreshTokenValue: string) {
  const stored = await authRepo.findRefreshToken(refreshTokenValue);
  if (!stored) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const user = await authRepo.findUserById(stored.user_id);
  if (!user || !user.is_active) {
    throw new AppError(401, 'User not found or deactivated');
  }

  const roles = await authRepo.findUserRoles(user.id, user.tenant_id);

  const authUser: AuthUser = {
    id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    roles: roles.map((r) => ({ role: r.role_name, division_id: r.division_id })),
    divisions: [...new Set(roles.filter((r) => r.division_name).map((r) => r.division_name as string))],
  };

  const accessToken = createAccessToken(authUser);

  return { accessToken };
}

export async function logout(refreshTokenValue: string): Promise<void> {
  await authRepo.revokeRefreshToken(refreshTokenValue);
}
