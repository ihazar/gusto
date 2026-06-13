import { UserRole } from '../common/enums';

export interface AuthUser {
  id: string;
  phone: string;
  displayName: string | null;
  roles: UserRole[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/** Generic ack returned by /auth/otp/request (never reveals if a number exists). */
export interface RequestOtpResponse {
  ok: true;
  /** Seconds the caller must wait before requesting another code. */
  resendAfter: number;
}

/** Decoded access-token payload. */
export interface JwtAccessPayload {
  sub: string;
  phone: string;
  roles: UserRole[];
}
