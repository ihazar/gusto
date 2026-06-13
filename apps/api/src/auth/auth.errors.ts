import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';

export class OtpVerificationError extends UnauthorizedException {
  constructor() {
    super('Invalid or expired code');
  }
}

export class OtpThrottledError extends HttpException {
  constructor(resendAfter: number) {
    super(
      { message: 'Too many code requests', resendAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
