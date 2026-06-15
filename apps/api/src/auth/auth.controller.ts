import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
    AuthResponse,
    RefreshDto,
    refreshSchema,
    RequestOtpDto,
    RequestOtpResponse,
    requestOtpSchema,
    LogoutDto,
    logoutSchema,
    VerifyOtpDto,
    verifyOtpSchema,
} from '@gusto/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post('otp/request')
    @HttpCode(HttpStatus.OK)
    requestOtp(@Body(new ZodValidationPipe(requestOtpSchema)) dto: RequestOtpDto): Promise<RequestOtpResponse> {
        return this.auth.requestOtp(dto.phone, dto.channel);
    }

    @Post('otp/verify')
    @HttpCode(HttpStatus.OK)
    verifyOtp(@Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto): Promise<AuthResponse> {
        return this.auth.verifyOtp(dto);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto): Promise<AuthResponse> {
        return this.auth.refresh(dto.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(@Body(new ZodValidationPipe(logoutSchema)) dto: LogoutDto): Promise<void> {
        await this.auth.logout(dto.refreshToken);
    }
}
