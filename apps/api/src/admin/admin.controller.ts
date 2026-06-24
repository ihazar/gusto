import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
    AdminChef,
    AdminCourier,
    AdminOrder,
    AdminStats,
    SetActiveDto,
    setActiveSchema,
    SetVerifiedDto,
    setVerifiedSchema,
    UserRole,
} from '@gusto/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';

/** Ops console. ADMIN role required (granted via ADMIN_PHONES). */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly admin: AdminService) {}

    @Get('stats')
    stats(): Promise<AdminStats> {
        return this.admin.stats();
    }

    @Get('chefs')
    chefs(): Promise<AdminChef[]> {
        return this.admin.listChefs();
    }

    @Post('chefs/:id/verify')
    verify(
        @Param('id') id: string,
        @Body(new ZodValidationPipe(setVerifiedSchema)) dto: SetVerifiedDto,
    ): Promise<AdminChef[]> {
        return this.admin.setVerified(id, dto.verified);
    }

    @Post('chefs/:id/active')
    active(
        @Param('id') id: string,
        @Body(new ZodValidationPipe(setActiveSchema)) dto: SetActiveDto,
    ): Promise<AdminChef[]> {
        return this.admin.setActive(id, dto.active);
    }

    @Get('orders')
    orders(): Promise<AdminOrder[]> {
        return this.admin.listOrders();
    }

    @Get('couriers')
    couriers(): Promise<AdminCourier[]> {
        return this.admin.listCouriers();
    }
}
