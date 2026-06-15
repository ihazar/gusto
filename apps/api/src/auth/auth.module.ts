import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from '../config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { OTP_PROVIDER, RATE_LIMITER, REFRESH_TOKEN_REPOSITORY, USER_REPOSITORY } from './ports';
import { MockOtpProvider } from './otp/mock-otp.provider';
import { TwilioOtpProvider } from './otp/twilio-otp.provider';
import { InMemoryRateLimiter } from './rate-limit/in-memory-rate-limiter';
import { RedisRateLimiter } from './rate-limit/redis-rate-limiter';
import { PrismaUserRepository } from './repositories/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './repositories/prisma-refresh-token.repository';

const otpProvider: Provider = {
    provide: OTP_PROVIDER,
    inject: [ConfigService, MockOtpProvider, TwilioOtpProvider],
    useFactory: (
        config: ConfigService<{ otp: AppConfig['otp'] }, true>,
        mock: MockOtpProvider,
        twilio: TwilioOtpProvider,
    ) => (config.get('otp', { infer: true }).provider === 'twilio' ? twilio : mock),
};

const rateLimiter: Provider = {
    provide: RATE_LIMITER,
    inject: [ConfigService, InMemoryRateLimiter, RedisRateLimiter],
    useFactory: (config: ConfigService<{ env: string }, true>, memory: InMemoryRateLimiter, redis: RedisRateLimiter) =>
        config.get('env', { infer: true }) === 'production' ? redis : memory,
};

@Module({
    imports: [PassportModule],
    controllers: [AuthController],
    providers: [
        AuthService,
        TokenService,
        JwtStrategy,
        RolesGuard,
        // candidate implementations (instantiated, selected by the factories below)
        MockOtpProvider,
        TwilioOtpProvider,
        InMemoryRateLimiter,
        RedisRateLimiter,
        otpProvider,
        rateLimiter,
        { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
        { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    ],
    exports: [TokenService, RolesGuard],
})
export class AuthModule {}
