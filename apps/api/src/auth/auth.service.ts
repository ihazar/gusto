import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AuthResponse,
  OtpChannel,
  RequestOtpResponse,
  VerifyOtpDto,
} from '@gusto/contracts';
import {
  OTP_PROVIDER,
  OtpProvider,
  RATE_LIMITER,
  RateLimiter,
  USER_REPOSITORY,
  UserRepository,
} from './ports';
import { TokenService } from './token.service';
import {
  OtpVerificationError,
  OtpThrottledError,
  OtpSendError,
  OtpRegionBlockedError,
} from './auth.errors';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Step 1 of phone 2FA. Always returns a generic ack so callers can't probe
   * which numbers exist. Throttled per phone.
   */
  async requestOtp(phone: string, channel: OtpChannel = 'sms'): Promise<RequestOtpResponse> {
    const limit = await this.rateLimiter.hit(`otp:${phone}`);
    if (!limit.allowed) {
      throw new OtpThrottledError(limit.resendAfter);
    }

    try {
      await this.otp.sendCode(phone, channel);
    } catch (err) {
      // Passwordless login creates the user at verify time, so request-time
      // failures reveal nothing about existing accounts — surface them so the
      // client can show a real error instead of a silent "ok".
      const msg = String((err as Error).message ?? '');
      this.logger.error(`OTP send failed for ${phone}: ${msg}`);
      if (/max send attempts/i.test(msg)) throw new OtpThrottledError(600);
      if (/block|fraud|geo|permission|prefix/i.test(msg)) throw new OtpRegionBlockedError();
      throw new OtpSendError();
    }

    return { ok: true, resendAfter: limit.resendAfter };
  }

  /**
   * Step 2 of phone 2FA. Verifies the code, creates the user on first login,
   * registers the device, and issues an access + refresh token pair.
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const ok = await this.otp.verifyCode(dto.phone, dto.code);
    if (!ok) {
      throw new OtpVerificationError();
    }

    const user =
      (await this.users.findByPhone(dto.phone)) ??
      (await this.users.createCustomer(dto.phone));

    if (dto.device) {
      await this.users.upsertDevice(user.id, dto.device);
    }

    const tokens = await this.tokens.issue(user, dto.device?.deviceId ?? null);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.displayName,
        roles: user.roles,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { tokens, user } = await this.tokens.rotate(refreshToken);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.displayName,
        roles: user.roles,
      },
      tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }
}
