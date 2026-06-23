import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Courier, CourierEarnings, DeliveryJob, DeliveryStatus, UpdateCourierDto } from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { JobRow, toCourier, toDeliveryJob } from './courier.mapper';

const JOB_INCLUDE = {
    order: { select: { customerName: true, total: true, items: { select: { qty: true } } } },
} satisfies Prisma.DeliveryJobInclude;

/**
 * "Gus" courier side: go online, claim deliveries from a job pool, pick up and
 * deliver. Completing a delivery captures the customer's payment and pays the
 * chef (via OrdersService). Proximity dispatch + GPS are deferred (ROADMAP §7).
 */
@Injectable()
export class CourierService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly orders: OrdersService,
    ) {}

    async getCourier(userId: string): Promise<Courier> {
        return toCourier(await this.ensureCourier(userId));
    }

    async updateCourier(userId: string, dto: UpdateCourierDto): Promise<Courier> {
        await this.ensureCourier(userId);
        const courier = await this.prisma.courier.update({
            where: { userId },
            data: { online: dto.online, vehicle: dto.vehicle, displayName: dto.displayName },
        });
        return toCourier(courier);
    }

    /** The courier's active jobs, plus the open pool when they're online. */
    async listJobs(userId: string): Promise<DeliveryJob[]> {
        const courier = await this.ensureCourier(userId);
        const active = await this.prisma.deliveryJob.findMany({
            where: { courierId: courier.id, status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP] } },
            orderBy: { createdAt: 'asc' },
            include: JOB_INCLUDE,
        });
        const available = courier.online
            ? await this.prisma.deliveryJob.findMany({
                  where: { status: DeliveryStatus.PENDING, courierId: null },
                  orderBy: { createdAt: 'asc' },
                  include: JOB_INCLUDE,
              })
            : [];
        return [...active, ...available].map((j) => toDeliveryJob(j as JobRow));
    }

    /** Claim a pending job (first-come; atomic). */
    async acceptJob(userId: string, jobId: string): Promise<DeliveryJob[]> {
        const courier = await this.ensureCourier(userId);
        if (!courier.online) throw new BadRequestException('Go online before accepting deliveries');
        const claimed = await this.prisma.deliveryJob.updateMany({
            where: { id: jobId, status: DeliveryStatus.PENDING, courierId: null },
            data: { status: DeliveryStatus.ASSIGNED, courierId: courier.id, assignedAt: new Date() },
        });
        if (claimed.count === 0) throw new BadRequestException('That delivery was already taken');
        return this.listJobs(userId);
    }

    async pickup(userId: string, jobId: string): Promise<DeliveryJob[]> {
        const courier = await this.ensureCourier(userId);
        await this.prisma.deliveryJob.updateMany({
            where: { id: jobId, courierId: courier.id, status: DeliveryStatus.ASSIGNED },
            data: { status: DeliveryStatus.PICKED_UP, pickedUpAt: new Date() },
        });
        return this.listJobs(userId);
    }

    async deliver(userId: string, jobId: string): Promise<DeliveryJob[]> {
        const courier = await this.ensureCourier(userId);
        const job = await this.prisma.deliveryJob.findFirst({
            where: { id: jobId, courierId: courier.id, status: DeliveryStatus.PICKED_UP },
        });
        if (job) {
            await this.prisma.deliveryJob.update({
                where: { id: job.id },
                data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date() },
            });
            // Capture payment + pay the chef + close the order.
            await this.orders.completeDelivery(job.orderId);
        }
        return this.listJobs(userId);
    }

    async earnings(userId: string): Promise<CourierEarnings> {
        const courier = await this.ensureCourier(userId);
        const done = await this.prisma.deliveryJob.findMany({
            where: { courierId: courier.id, status: DeliveryStatus.DELIVERED },
            select: { fee: true, currency: true },
        });
        const total = Math.round(done.reduce((s, j) => s + j.fee, 0) * 100) / 100;
        return { currency: done[0]?.currency ?? 'ILS', total, deliveredCount: done.length };
    }

    private ensureCourier(userId: string) {
        return this.prisma.courier.upsert({ where: { userId }, create: { userId }, update: {} });
    }
}
