import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiter, RateLimitResult } from '../ports';
import { AppConfig } from '../../config/configuration';

/**
 * In-memory fixed-window limiter — the dev/test default so the API runs with
 * no Redis. Swap for RedisRateLimiter in production (see redis-rate-limiter.ts).
 */
@Injectable()
export class InMemoryRateLimiter implements RateLimiter {
    private readonly hits = new Map<string, number[]>();
    private readonly windowMs: number;
    private readonly max: number;

    constructor(config: ConfigService<{ otp: AppConfig['otp'] }, true>) {
        const otp = config.get('otp', { infer: true });
        this.windowMs = otp.requestWindow * 1000;
        this.max = otp.maxRequestsPerWindow;
    }

    async hit(key: string): Promise<RateLimitResult> {
        const now = Date.now();
        const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);

        if (recent.length >= this.max) {
            const resendAfter = Math.ceil((this.windowMs - (now - recent[0])) / 1000);
            this.hits.set(key, recent);
            return { allowed: false, resendAfter };
        }

        recent.push(now);
        this.hits.set(key, recent);
        return { allowed: true, resendAfter: Math.ceil(this.windowMs / 1000) };
    }
}
