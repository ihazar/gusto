import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RateLimiter, RateLimitResult } from '../ports';
import { AppConfig } from '../../config/configuration';

/**
 * Redis fixed-window limiter for production / multi-instance deploys.
 * Wire it in auth.module.ts in place of InMemoryRateLimiter when REDIS_URL is set.
 */
@Injectable()
export class RedisRateLimiter implements RateLimiter {
    private readonly redis: Redis;
    private readonly windowSec: number;
    private readonly max: number;

    constructor(config: ConfigService<{ otp: AppConfig['otp']; redisUrl: string }, true>) {
        const otp = config.get('otp', { infer: true });
        this.windowSec = otp.requestWindow;
        this.max = otp.maxRequestsPerWindow;
        const url = config.get('redisUrl', { infer: true });
        this.redis = new Redis(url, {
            // lazyConnect so registering this provider in dev/mock mode doesn't open
            // a socket to a Redis that may not be running.
            lazyConnect: true,
            // Heroku Key-Value Store serves rediss:// with a self-signed cert.
            ...(url.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {}),
        });
    }

    async hit(key: string): Promise<RateLimitResult> {
        const redisKey = `otp:rl:${key}`;
        const count = await this.redis.incr(redisKey);
        if (count === 1) {
            await this.redis.expire(redisKey, this.windowSec);
        }
        const ttl = await this.redis.ttl(redisKey);
        const resendAfter = ttl > 0 ? ttl : this.windowSec;

        return { allowed: count <= this.max, resendAfter };
    }
}
