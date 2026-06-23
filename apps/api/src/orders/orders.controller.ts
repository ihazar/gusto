import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateOrderDto, createOrderSchema, Order, OrderTracking } from '@gusto/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly orders: OrdersService) {}

    /** Place + pay for an order. */
    @Post('orders')
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderDto,
    ): Promise<Order> {
        return this.orders.createOrder(user.id, user.phone, dto);
    }

    /** The signed-in customer's order history. */
    @Get('me/orders')
    mine(@CurrentUser() user: AuthenticatedUser): Promise<Order[]> {
        return this.orders.listForCustomer(user.id);
    }

    /** Live delivery tracking for one of the customer's orders. */
    @Get('orders/:id/tracking')
    tracking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<OrderTracking> {
        return this.orders.getTracking(user.id, id);
    }
}
