import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto, Order } from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { computeTotals } from './fees';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { ORDER_INCLUDE, toOrder } from './orders.mapper';

/**
 * Customer ordering: turn a single-kitchen cart into a paid (authorized) order
 * the chef can see. Prices are taken from the server's dishes, never trusted
 * from the client.
 */
@Injectable()
export class OrdersService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    ) {}

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
}
