import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminChef, AdminCourier, AdminOrder, AdminStats } from '@gusto/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Read + moderation queries for the ops console. ADMIN-gated. */
@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) {}

    async stats(): Promise<AdminStats> {
        const [chefs, activeChefs, pendingVerification, couriers, orders, delivered, gmv] = await Promise.all([
            this.prisma.chefProfile.count({ where: { onboarded: true } }),
            this.prisma.chefProfile.count({ where: { onboarded: true, active: true } }),
            this.prisma.chefProfile.count({ where: { onboarded: true, verified: false } }),
            this.prisma.courier.count(),
            this.prisma.order.count(),
            this.prisma.order.count({ where: { status: 'DELIVERED' } }),
            this.prisma.order.aggregate({ _sum: { total: true }, where: { status: 'DELIVERED' } }),
        ]);
        return {
            chefs,
            activeChefs,
            pendingVerification,
            couriers,
            orders,
            delivered,
            gmv: Math.round((gmv._sum.total ?? 0) * 100) / 100,
            currency: 'ILS',
        };
    }

    async listChefs(): Promise<AdminChef[]> {
        const chefs = await this.prisma.chefProfile.findMany({
            where: { onboarded: true },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { dishes: true, orders: true } } },
        });
        return chefs.map((c) => ({
            id: c.id,
            kitchenName: c.kitchenName,
            name: c.name,
            city: c.city,
            onboarded: c.onboarded,
            active: c.active,
            verified: c.verified,
            rating: c.ratingCount ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : 0,
            ratingCount: c.ratingCount,
            dishCount: c._count.dishes,
            orderCount: c._count.orders,
            createdAt: c.createdAt.toISOString(),
        }));
    }

    async setVerified(id: string, verified: boolean): Promise<AdminChef[]> {
        await this.requireChef(id);
        await this.prisma.chefProfile.update({ where: { id }, data: { verified } });
        return this.listChefs();
    }

    async setActive(id: string, active: boolean): Promise<AdminChef[]> {
        await this.requireChef(id);
        await this.prisma.chefProfile.update({ where: { id }, data: { active } });
        return this.listChefs();
    }

    async listOrders(): Promise<AdminOrder[]> {
        const orders = await this.prisma.order.findMany({
            orderBy: { placedAt: 'desc' },
            take: 50,
            include: { chef: { select: { kitchenName: true } } },
        });
        return orders.map((o) => ({
            id: o.id,
            kitchenName: o.chef.kitchenName,
            customerName: o.customerName,
            status: o.status,
            total: o.total,
            currency: o.currency,
            placedAt: o.placedAt.toISOString(),
        }));
    }

    async listCouriers(): Promise<AdminCourier[]> {
        const couriers = await this.prisma.courier.findMany({ orderBy: { createdAt: 'desc' } });
        const delivered = await this.prisma.deliveryJob.groupBy({
            by: ['courierId'],
            where: { status: 'DELIVERED' },
            _count: { _all: true },
            _sum: { fee: true },
        });
        const byCourier = new Map(delivered.map((d) => [d.courierId, d]));
        return couriers.map((c) => {
            const d = byCourier.get(c.id);
            return {
                id: c.id,
                displayName: c.displayName || 'Courier',
                vehicle: c.vehicle,
                online: c.online,
                deliveredCount: d?._count._all ?? 0,
                earnings: Math.round((d?._sum.fee ?? 0) * 100) / 100,
            };
        });
    }

    private async requireChef(id: string): Promise<void> {
        const exists = await this.prisma.chefProfile.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException('Chef not found');
    }
}
