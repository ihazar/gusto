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

export class OtpSendError extends HttpException {
  constructor() {
    super(
      "Couldn't send a code to that number — check it and try again.",
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class OtpRegionBlockedError extends HttpException {
  constructor() {
    super(
      "We can't send a code to that number right now — the messaging provider has restricted this region/channel.",
      HttpStatus.BAD_REQUEST,
    );
  }
}
