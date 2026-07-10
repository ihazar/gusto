import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';

type ExpireHandler = (orderId: string) => Promise<void>;

const QUEUE_NAME = 'order-accept-timeout';

/**
 * Durable accept-timeout scheduling on BullMQ (Redis): one delayed job per
 * order, fired when the chef's accept window ends. Survives process restarts,
 * unlike the in-process sweep — which OrdersService keeps only as a low-
 * frequency safety net for orders enqueued while Redis was unreachable.
 */
@Injectable()
export class AcceptTimeoutQueue implements OnModuleInit, OnModuleDestroy {
    private queue?: Queue;
    private worker?: Worker;
    private handler?: ExpireHandler;

    constructor(private readonly config: ConfigService) {}

    /** OrdersService registers what to do when an order's accept window ends. */
    onExpire(handler: ExpireHandler): void {
        this.handler = handler;
    }

    /** Schedule the timeout for one order. jobId = orderId, so it's idempotent. */
    async schedule(orderId: string, delayMs: number): Promise<void> {
        try {
            await this.queue?.add(
                'expire',
                { orderId },
                { jobId: orderId, delay: delayMs, removeOnComplete: true, removeOnFail: true },
            );
        } catch {
            // Redis unreachable — the sweep in OrdersService will catch this order.
        }
    }

    onModuleInit(): void {
        const url = this.config.get<string>('redisUrl');
        if (!url) return;
        // Plain options (not a shared ioredis instance): BullMQ opens its own
        // blocking connections, and its bundled ioredis types differ from ours.
        const u = new URL(url);
        const connection = {
            host: u.hostname,
            port: Number(u.port || 6379),
            username: u.username || undefined,
            password: u.password || undefined,
            maxRetriesPerRequest: null, // required by BullMQ
            // Heroku Key-Value Store serves rediss:// with a self-signed cert.
            ...(u.protocol === 'rediss:' ? { tls: { rejectUnauthorized: false } } : {}),
        };
        this.queue = new Queue(QUEUE_NAME, { connection });
        this.worker = new Worker(
            QUEUE_NAME,
            async (job: Job<{ orderId: string }>) => this.handler?.(job.data.orderId),
            { connection },
        );
        // A down Redis must not crash the API; the sweep is the fallback.
        this.queue.on('error', () => undefined);
        this.worker.on('error', () => undefined);
    }

    async onModuleDestroy(): Promise<void> {
        await Promise.allSettled([this.queue?.close(), this.worker?.close()]);
    }
}
