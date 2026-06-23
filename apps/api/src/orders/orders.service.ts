import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Order as POrder, Payment as PPayment } from '@prisma/client';
import {
    ChefEarnings,
    CreateOrderDto,
    CreateReviewDto,
    DeliveryStatus,
    Order,
    OrderStatus,
    OrderTracking,
    Vehicle,
} from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { computeTotals } from './fees';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { ORDER_INCLUDE, toOrder } from './orders.mapper';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Customer ordering + the chef-side order lifecycle (accept/reject/advance)
 * with its payment side effects: authorize at order time, capture on delivery
 * (recording a chef payout), void/refund on cancel. A background sweep
 * auto-cancels orders the chef never accepts (BullMQ is the production path).
 */
@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
    private sweepTimer?: ReturnType<typeof setInterval>;
    private readonly acceptTimeoutMs = Number(process.env.ORDER_ACCEPT_TIMEOUT_MIN ?? 15) * 60_000;

    constructor(
        private readonly prisma: PrismaService,
        @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    ) {}

    onModuleInit(): void {
        this.sweepTimer = setInterval(() => void this.sweepStaleOrders().catch(() => undefined), 60_000);
    }

    onModuleDestroy(): void {
        if (this.sweepTimer) clearInterval(this.sweepTimer);
    }

    async createOrder(customerId: string, customerName: string, dto: CreateOrderDto): Promise<Order> {
        const kitchen = await this.prisma.chefProfile.findFirst({
            where: { id: dto.kitchenId, onboarded: true, active: true },
            include: { dishes: { where: { available: true } } },
        });
        if (!kitchen) throw new NotFoundException('Kitchen not available');
        if (!kitchen.acceptingOrders) throw new BadRequestException('This kitchen is not taking orders right now');

        const dishes = new Map(kitchen.dishes.map((d) => [d.id, d]));
        const lines = dto.items.map((it) => {
            const dish = dishes.get(it.dishId);
            if (!dish) throw new BadRequestException(`Dish ${it.dishId} is not available`);
            return { dish, qty: it.qty };
        });

        const currency = lines[0].dish.currency;
        const subtotal = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
        const t = computeTotals(subtotal, dto.tip, currency);

        const order = await this.prisma.order.create({
            data: {
                customerId,
                customerName,
                chefProfileId: kitchen.id,
                status: 'NEW',
                subtotal: t.subtotal,
                serviceFee: t.serviceFee,
                deliveryFee: t.deliveryFee,
                tip: t.tip,
                vat: t.vat,
                total: t.total,
                commission: t.commission,
                currency,
                deliveryAddress: dto.deliveryAddress,
                items: {
                    create: lines.map((l) => ({
                        dishId: l.dish.id,
                        name: l.dish.name,
                        qty: l.qty,
                        unitPrice: l.dish.price,
                    })),
                },
            },
            include: ORDER_INCLUDE,
        });

        // Authorize (not capture) the total; capture happens on handoff (M4).
        const auth = await this.payments.authorize(t.total, currency, order.id);
        const payment = await this.prisma.payment.create({
            data: {
                orderId: order.id,
                provider: auth.provider,
                providerRef: auth.providerRef,
                status: auth.status === 'AUTHORIZED' ? 'AUTHORIZED' : 'FAILED',
                amount: t.total,
                currency,
            },
        });

        return toOrder({ ...order, payment });
    }

    async listForCustomer(customerId: string): Promise<Order[]> {
        const rows = await this.prisma.order.findMany({
            where: { customerId },
            orderBy: { placedAt: 'desc' },
            include: ORDER_INCLUDE,
        });
        return rows.map(toOrder);
    }

    /** Leave a rating + comment on a delivered order (once). */
    async createReview(customerId: string, orderId: string, dto: CreateReviewDto): Promise<void> {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, customerId },
            include: { review: { select: { id: true } } },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('You can review once it’s delivered');
        if (order.review) throw new BadRequestException('You already reviewed this order');
        await this.prisma.$transaction([
            this.prisma.review.create({
                data: {
                    orderId,
                    customerId,
                    chefProfileId: order.chefProfileId,
                    rating: dto.rating,
                    comment: dto.comment,
                },
            }),
            this.prisma.chefProfile.update({
                where: { id: order.chefProfileId },
                data: { ratingSum: { increment: dto.rating }, ratingCount: { increment: 1 } },
            }),
        ]);
    }

    // ── chef side ─────────────────────────────────────────────────────────

    async chefListOrders(chefUserId: string): Promise<Order[]> {
        const profile = await this.chefProfileId(chefUserId);
        if (!profile) return [];
        const rows = await this.prisma.order.findMany({
            where: { chefProfileId: profile },
            orderBy: { placedAt: 'desc' },
            include: ORDER_INCLUDE,
        });
        return rows.map(toOrder);
    }

    /** Move one of the chef's orders to a new status, applying payment effects. */
    async chefSetStatus(chefUserId: string, orderId: string, status: OrderStatus): Promise<Order[]> {
        const profile = await this.chefProfileId(chefUserId);
        if (profile) {
            const order = await this.prisma.order.findFirst({
                where: { id: orderId, chefProfileId: profile },
                include: { payment: true },
            });
            // Terminal states are final.
            if (order && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED) {
                await this.applyTransition(order, status);
            }
        }
        return this.chefListOrders(chefUserId);
    }

    async chefEarnings(chefUserId: string): Promise<ChefEarnings> {
        const profile = await this.chefProfileId(chefUserId);
        const empty: ChefEarnings = { currency: 'ILS', paidOut: 0, pending: 0, deliveredCount: 0 };
        if (!profile) return empty;
        const payouts = await this.prisma.payout.findMany({ where: { chefProfileId: profile } });
        const sum = (s: 'PAID' | 'PENDING') =>
            round2(payouts.filter((p) => p.status === s).reduce((n, p) => n + p.amount, 0));
        return {
            currency: payouts[0]?.currency ?? 'ILS',
            paidOut: sum('PAID'),
            pending: sum('PENDING'),
            deliveredCount: payouts.length,
        };
    }

    private async applyTransition(order: POrder & { payment: PPayment | null }, status: OrderStatus): Promise<void> {
        if (status === OrderStatus.CANCELLED) {
            await this.releaseFunds(order);
            await this.prisma.deliveryJob.updateMany({
                where: { orderId: order.id, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
                data: { status: 'CANCELLED' },
            });
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
        } else if (status === OrderStatus.ON_THE_WAY) {
            // Chef hands off: create the delivery job for the courier pool.
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
            await this.createDeliveryJob(order.id);
        } else if (status === OrderStatus.IN_PREPARATION) {
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
        }
        // DELIVERED is courier-driven (completeDelivery), not a chef transition.
    }

    /** Create the PENDING delivery job for an order (idempotent). */
    private async createDeliveryJob(orderId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { chef: { select: { lat: true, lng: true, kitchenName: true } }, delivery: true },
        });
        if (!order || order.delivery) return;
        const drop = synthDropoff(order.chef.lat, order.chef.lng, order.id);
        await this.prisma.deliveryJob.create({
            data: {
                orderId: order.id,
                status: 'PENDING',
                pickupLat: order.chef.lat,
                pickupLng: order.chef.lng,
                pickupName: order.chef.kitchenName || 'Kitchen',
                dropoffLat: drop.lat,
                dropoffLng: drop.lng,
                dropoffAddress: order.deliveryAddress,
                fee: round2(order.deliveryFee + order.tip),
                currency: order.currency,
            },
        });
    }

    /** Courier-completed delivery: capture funds, pay the chef, close the order. */
    async completeDelivery(orderId: string): Promise<void> {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
        if (!order || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) return;
        await this.captureAndPayout(order);
        await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.DELIVERED } });
    }

    /** Void a still-authorized payment, or refund a captured one. */
    private async releaseFunds(order: POrder & { payment: PPayment | null }): Promise<void> {
        const p = order.payment;
        if (!p) return;
        if (p.status === 'AUTHORIZED') await this.payments.void(p.providerRef);
        else if (p.status === 'CAPTURED') await this.payments.refund(p.providerRef);
        else return;
        await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'REFUNDED' } });
    }

    /** Capture funds and record the chef's payout (subtotal − commission). */
    private async captureAndPayout(order: POrder & { payment: PPayment | null }): Promise<void> {
        if (order.payment?.status === 'AUTHORIZED') {
            await this.payments.capture(order.payment.providerRef);
            await this.prisma.payment.update({ where: { id: order.payment.id }, data: { status: 'CAPTURED' } });
        }
        await this.prisma.payout.upsert({
            where: { orderId: order.id },
            create: {
                chefProfileId: order.chefProfileId,
                orderId: order.id,
                amount: round2(order.subtotal - order.commission),
                currency: order.currency,
                status: 'PENDING',
            },
            update: {},
        });
    }

    /** Auto-cancel + void orders the chef never accepted within the window. */
    private async sweepStaleOrders(): Promise<void> {
        const cutoff = new Date(Date.now() - this.acceptTimeoutMs);
        const stale = await this.prisma.order.findMany({
            where: { status: OrderStatus.NEW, placedAt: { lt: cutoff } },
            include: { payment: true },
        });
        for (const order of stale) {
            await this.releaseFunds(order);
            await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
        }
    }

    private async chefProfileId(userId: string): Promise<string | null> {
        const p = await this.prisma.chefProfile.findUnique({ where: { userId }, select: { id: true } });
        return p?.id ?? null;
    }

    /** Live tracking for the customer who owns the order. */
    async getTracking(customerId: string, orderId: string): Promise<OrderTracking> {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, customerId },
            include: { delivery: { include: { courier: true } } },
        });
        if (!order) throw new NotFoundException('Order not found');
        const d = order.delivery;
        const tracking: OrderTracking = { orderStatus: order.status as OrderStatus };
        if (d && d.status !== DeliveryStatus.CANCELLED) {
            const pickup = { lat: d.pickupLat, lng: d.pickupLng };
            const dropoff = { lat: d.dropoffLat, lng: d.dropoffLng };
            let progress = 0;
            let position = pickup;
            let eta = DELIVER_MINUTES;
            if (d.status === DeliveryStatus.PICKED_UP && d.pickedUpAt) {
                const elapsedMin = (Date.now() - d.pickedUpAt.getTime()) / 60_000;
                progress = Math.min(elapsedMin / DELIVER_MINUTES, 1);
                position = lerp(pickup, dropoff, progress);
                eta = Math.max(0, Math.ceil(DELIVER_MINUTES * (1 - progress)));
            } else if (d.status === DeliveryStatus.DELIVERED) {
                progress = 1;
                position = dropoff;
                eta = 0;
            }
            tracking.delivery = {
                status: d.status as DeliveryStatus,
                courierName: d.courier?.displayName || undefined,
                vehicle: (d.courier?.vehicle as Vehicle) || undefined,
                pickup,
                dropoff,
                courierPosition: position,
                etaMinutes: eta,
                progress: round2(progress),
            };
        }
        return tracking;
    }
}

/** Fixed door-to-door delivery time (minutes) used for the simulated ETA. */
const DELIVER_MINUTES = 12;

function lerp(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Deterministic dropoff ~1 km from the kitchen (we don't geocode addresses yet). */
function synthDropoff(lat: number, lng: number, seed: string): { lat: number; lng: number } {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const dLat = ((h % 200) - 100) / 10_000; // ±0.01° ≈ ±1.1 km
    const dLng = (((h >> 8) % 200) - 100) / 10_000;
    return { lat: lat + dLat, lng: lng + dLng };
}
