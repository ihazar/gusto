import { DevicePlatform, UserRole } from '@hearth/contracts';

/** Injection tokens for the auth ports (swap impls per environment/test). */
export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
export const RATE_LIMITER = Symbol('RATE_LIMITER');
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface UserRecord {
  id: string;
  phone: string;
  displayName: string | null;
  roles: UserRole[];
}

export interface DeviceInfo {
  deviceId: string;
  platform: DevicePlatform;
  pushToken?: string;
}

/** Sends and verifies one-time codes (Twilio Verify in prod, mock in dev/test). */
export interface OtpProvider {
  sendCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<boolean>;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the next request is permitted. */
  resendAfter: number;
}

/** Throttles OTP requests per phone (Redis-backed in prod, in-memory in dev/test). */
export interface RateLimiter {
  hit(key: string): Promise<RateLimitResult>;
}

export interface UserRepository {
  findByPhone(phone: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createCustomer(phone: string): Promise<UserRecord>;
  upsertDevice(userId: string, device: DeviceInfo): Promise<void>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  deviceId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    deviceId: string | null;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  markRotated(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
