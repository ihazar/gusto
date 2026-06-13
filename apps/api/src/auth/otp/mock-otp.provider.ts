import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { OtpProvider } from '../ports';
import { AppConfig } from '../../config/configuration';

interface Challenge {
  code: string;
  expiresAt: number;
  attempts: number;
}

/**
 * Dev/test OTP provider. Logs the code instead of sending an SMS so the flow
 * is fully exercisable with no Twilio credentials. The fixed code `000000` is
 * always accepted in non-production to make manual testing trivial.
 */
@Injectable()
export class MockOtpProvider implements OtpProvider {
  private readonly logger = new Logger(MockOtpProvider.name);
  private readonly challenges = new Map<string, Challenge>();
  private readonly cfg: AppConfig['otp'];
  private readonly isProd: boolean;

  constructor(config: ConfigService<{ otp: AppConfig['otp']; env: string }, true>) {
    this.cfg = config.get('otp', { infer: true });
    this.isProd = config.get('env', { infer: true }) === 'production';
  }

  async sendCode(phone: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    this.challenges.set(phone, {
      code,
      expiresAt: Date.now() + this.cfg.codeTtl * 1000,
      attempts: 0,
    });
    this.logger.warn(`[MOCK OTP] ${phone} -> ${code} (or use 000000 in dev)`);
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    if (!this.isProd && code === '000000') return true;

    const challenge = this.challenges.get(phone);
    if (!challenge) return false;
    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(phone);
      return false;
    }
    if (++challenge.attempts > this.cfg.maxAttempts) {
      this.challenges.delete(phone);
      return false;
    }
    if (challenge.code !== code) return false;

    this.challenges.delete(phone);
    return true;
  }
}
