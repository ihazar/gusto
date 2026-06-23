import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Order as POrder, Payment as PPayment } from '@prisma/client';
import { ChefEarnings, CreateOrderDto, Order, OrderStatus } from '@gusto/contracts';
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
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
        } else if (status === OrderStatus.DELIVERED) {
            await this.captureAndPayout(order);
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
        } else {
            await this.prisma.order.update({ where: { id: order.id }, data: { status } });
        }
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
}
