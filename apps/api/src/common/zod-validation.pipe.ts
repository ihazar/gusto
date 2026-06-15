import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates a request payload against a zod schema from @gusto/contracts,
 * so server and clients share one definition. Usage:
 *   @Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto
 */
export class ZodValidationPipe<T> implements PipeTransform {
    constructor(private readonly schema: ZodSchema<T>) {}

    transform(value: unknown): T {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new BadRequestException({
                message: 'Validation failed',
                issues: result.error.issues.map((i) => ({
                    path: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        return result.data;
    }
}
