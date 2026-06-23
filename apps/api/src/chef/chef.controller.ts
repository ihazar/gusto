import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
    Chef,
    ChefEarnings,
    CreateMealDto,
    createMealSchema,
    OnboardingDto,
    onboardingSchema,
    Order,
    UpdateChefProfileDto,
    updateChefProfileSchema,
    UpdateChefSettingsDto,
    updateChefSettingsSchema,
    UpdateMealDto,
    updateMealSchema,
    UpdateOrderStatusDto,
    updateOrderStatusSchema,
} from '@gusto/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from '../orders/orders.service';
import { ChefService } from './chef.service';

/**
 * Onboarding endpoints for the signed-in chef. Gated by JwtAuthGuard only (not
 * a CHEF-role check) because onboarding is exactly where a user becomes a chef.
 */
@Controller('chef')
@UseGuards(JwtAuthGuard)
export class ChefController {
    constructor(
        private readonly chefs: ChefService,
        private readonly orders: OrdersService,
    ) {}

    @Get('me')
    getMine(@CurrentUser() user: AuthenticatedUser): Promise<Chef> {
        return this.chefs.getForUser(user.id);
    }

    @Patch('me')
    updateProfile(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateChefProfileSchema)) dto: UpdateChefProfileDto,
    ): Promise<Chef> {
        return this.chefs.updateProfile(user.id, dto);
    }

    @Patch('me/settings')
    updateSettings(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateChefSettingsSchema)) dto: UpdateChefSettingsDto,
    ): Promise<Chef> {
        return this.chefs.updateSettings(user.id, dto);
    }

    @Post('me/onboarding/complete')
    completeOnboarding(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(onboardingSchema)) dto: OnboardingDto,
    ): Promise<Chef> {
        return this.chefs.completeOnboarding(user.id, dto);
    }

    @Post('me/meals')
    addMeal(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createMealSchema)) dto: CreateMealDto,
    ): Promise<Chef> {
        return this.chefs.addMeal(user.id, dto);
    }

    @Patch('me/meals/:mealId')
    updateMeal(
        @CurrentUser() user: AuthenticatedUser,
        @Param('mealId') mealId: string,
        @Body(new ZodValidationPipe(updateMealSchema)) dto: UpdateMealDto,
    ): Promise<Chef> {
        return this.chefs.updateMeal(user.id, mealId, dto);
    }

    @Get('me/orders')
    listOrders(@CurrentUser() user: AuthenticatedUser): Promise<Order[]> {
        return this.orders.chefListOrders(user.id);
    }

    @Patch('me/orders/:orderId')
    updateOrderStatus(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodValidationPipe(updateOrderStatusSchema)) dto: UpdateOrderStatusDto,
    ): Promise<Order[]> {
        return this.orders.chefSetStatus(user.id, orderId, dto.status);
    }

    @Get('me/earnings')
    earnings(@CurrentUser() user: AuthenticatedUser): Promise<ChefEarnings> {
        return this.orders.chefEarnings(user.id);
    }
}
