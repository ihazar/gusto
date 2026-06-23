import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Courier, CourierEarnings, DeliveryJob, UpdateCourierDto, updateCourierSchema } from '@gusto/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CourierService } from './courier.service';

/** "Gus" courier endpoints. JwtAuthGuard only — any user can drive. */
@Controller('courier')
@UseGuards(JwtAuthGuard)
export class CourierController {
    constructor(private readonly couriers: CourierService) {}

    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): Promise<Courier> {
        return this.couriers.getCourier(user.id);
    }

    @Patch('me')
    update(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateCourierSchema)) dto: UpdateCourierDto,
    ): Promise<Courier> {
        return this.couriers.updateCourier(user.id, dto);
    }

    @Get('jobs')
    jobs(@CurrentUser() user: AuthenticatedUser): Promise<DeliveryJob[]> {
        return this.couriers.listJobs(user.id);
    }

    @Post('jobs/:id/accept')
    accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DeliveryJob[]> {
        return this.couriers.acceptJob(user.id, id);
    }

    @Post('jobs/:id/pickup')
    pickup(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DeliveryJob[]> {
        return this.couriers.pickup(user.id, id);
    }

    @Post('jobs/:id/deliver')
    deliver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<DeliveryJob[]> {
        return this.couriers.deliver(user.id, id);
    }

    @Get('earnings')
    earnings(@CurrentUser() user: AuthenticatedUser): Promise<CourierEarnings> {
        return this.couriers.earnings(user.id);
    }
}
