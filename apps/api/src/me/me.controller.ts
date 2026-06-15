import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
    @Get()
    getProfile(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
        return user;
    }
}
