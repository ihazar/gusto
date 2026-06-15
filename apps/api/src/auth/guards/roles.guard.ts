import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@gusto/contracts';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Use together with JwtAuthGuard. @Roles(UserRole.ADMIN) gates a handler. */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required || required.length === 0) return true;

        const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
        if (!user || !required.some((role) => user.roles.includes(role))) {
            throw new ForbiddenException('Insufficient role');
        }
        return true;
    }
}
