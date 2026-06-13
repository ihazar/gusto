import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';
import { OtpProvider } from '../ports';
import { AppConfig } from '../../config/configuration';

/**
 * Production OTP provider backed by Twilio Verify. Twilio owns code generation,
 * delivery, expiry and attempt-throttling — we only request and check.
 *
 * The client is created lazily so this provider can be registered (but unused)
 * in dev/mock mode without valid credentials.
 */
@Injectable()
export class TwilioOtpProvider implements OtpProvider {
  private readonly logger = new Logger(TwilioOtpProvider.name);
  private readonly cfg: AppConfig['twilio'];
  private clientRef: Twilio | null = null;

  constructor(config: ConfigService<{ twilio: AppConfig['twilio'] }, true>) {
    this.cfg = config.get('twilio', { infer: true });
  }

  private get client(): Twilio {
    if (!this.clientRef) {
      this.clientRef = twilio(this.cfg.accountSid, this.cfg.authToken);
    }
    return this.clientRef;
  }

  async sendCode(phone: string): Promise<void> {
    await this.client.verify.v2
      .services(this.cfg.verifyServiceSid)
      .verifications.create({ to: phone, channel: 'sms' });
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    try {
      const check = await this.client.verify.v2
        .services(this.cfg.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });
      return check.status === 'approved';
    } catch (err) {
      // Twilio 404s once a verification is consumed/expired — treat as failure.
      this.logger.debug(`verifyCode failed for ${phone}: ${(err as Error).message}`);
      return false;
    }
  }
}
