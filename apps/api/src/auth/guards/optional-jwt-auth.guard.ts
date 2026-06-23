import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Like JwtAuthGuard but never rejects: a valid token populates `request.user`,
 * a missing/invalid one leaves it null. Use on public endpoints that tailor
 * their response when the caller happens to be signed in.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest<T = AuthenticatedUser>(_err: unknown, user: T | false): T | null {
        return user || null;
    }
}
