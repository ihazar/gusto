import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
    Chef,
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
import { ChefService } from './chef.service';

/**
 * Onboarding endpoints for the signed-in chef. Gated by JwtAuthGuard only (not
 * a CHEF-role check) because onboarding is exactly where a user becomes a chef.
 */
@Controller('chef')
@UseGuards(JwtAuthGuard)
export class ChefController {
    constructor(private readonly chefs: ChefService) {}

    @Get('me')
    getMine(@CurrentUser() user: AuthenticatedUser): Chef {
        return this.chefs.getForUser(user.id);
    }

    @Patch('me')
    updateProfile(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateChefProfileSchema)) dto: UpdateChefProfileDto,
    ): Chef {
        return this.chefs.updateProfile(user.id, dto);
    }

    @Patch('me/settings')
    updateSettings(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(updateChefSettingsSchema)) dto: UpdateChefSettingsDto,
    ): Chef {
        return this.chefs.updateSettings(user.id, dto);
    }

    @Post('me/onboarding/complete')
    completeOnboarding(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(onboardingSchema)) dto: OnboardingDto,
    ): Chef {
        return this.chefs.completeOnboarding(user.id, dto);
    }

    @Post('me/meals')
    addMeal(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createMealSchema)) dto: CreateMealDto,
    ): Chef {
        return this.chefs.addMeal(user.id, dto);
    }

    @Patch('me/meals/:mealId')
    updateMeal(
        @CurrentUser() user: AuthenticatedUser,
        @Param('mealId') mealId: string,
        @Body(new ZodValidationPipe(updateMealSchema)) dto: UpdateMealDto,
    ): Chef {
        return this.chefs.updateMeal(user.id, mealId, dto);
    }

    @Get('me/orders')
    listOrders(@CurrentUser() user: AuthenticatedUser): Order[] {
        return this.chefs.listOrders(user.id);
    }

    @Patch('me/orders/:orderId')
    updateOrderStatus(
        @CurrentUser() user: AuthenticatedUser,
        @Param('orderId') orderId: string,
        @Body(new ZodValidationPipe(updateOrderStatusSchema)) dto: UpdateOrderStatusDto,
    ): Order[] {
        return this.chefs.updateOrderStatus(user.id, orderId, dto.status);
    }
}
