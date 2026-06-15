import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { AuthTokens, JwtAccessPayload } from '@gusto/contracts';
import { AppConfig } from '../config/configuration';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, USER_REPOSITORY, UserRecord, UserRepository } from './ports';

@Injectable()
export class TokenService {
    private readonly jwtCfg: AppConfig['jwt'];

    constructor(
        config: ConfigService<{ jwt: AppConfig['jwt'] }, true>,
        @Inject(REFRESH_TOKEN_REPOSITORY)
        private readonly refreshTokens: RefreshTokenRepository,
        @Inject(USER_REPOSITORY)
        private readonly users: UserRepository,
    ) {
        this.jwtCfg = config.get('jwt', { infer: true });
    }

    /** Issue a fresh access + refresh pair and persist the refresh-token hash. */
    async issue(user: UserRecord, deviceId: string | null): Promise<AuthTokens> {
        const accessToken = this.signAccess(user);
        const refreshToken = randomBytes(48).toString('base64url');

        await this.refreshTokens.create({
            userId: user.id,
            deviceId,
            tokenHash: this.hash(refreshToken),
            expiresAt: new Date(Date.now() + this.jwtCfg.refreshTtl * 1000),
        });

        return { accessToken, refreshToken, expiresIn: this.jwtCfg.accessTtl };
    }

    /**
     * Rotate a refresh token: validate, revoke the old one, issue a new pair.
     * If a token that was already rotated out is presented again, that's a reuse
     * attack — revoke the whole family for the user and reject.
     */
    async rotate(presentedToken: string): Promise<{ tokens: AuthTokens; user: UserRecord }> {
        const record = await this.refreshTokens.findByHash(this.hash(presentedToken));

        if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException('Invalid refresh token');
        }
        if (record.rotatedAt) {
            // Reuse of a rotated token — nuke the family.
            await this.refreshTokens.revokeAllForUser(record.userId);
            throw new UnauthorizedException('Refresh token reuse detected');
        }

        const user = await this.users.findById(record.userId);
        if (!user) throw new UnauthorizedException('User no longer exists');

        await this.refreshTokens.markRotated(record.id);
        const tokens = await this.issue(user, record.deviceId);
        return { tokens, user };
    }

    async revoke(presentedToken: string): Promise<void> {
        const record = await this.refreshTokens.findByHash(this.hash(presentedToken));
        if (record && !record.revokedAt) {
            await this.refreshTokens.revoke(record.id);
        }
    }

    verifyAccess(token: string): JwtAccessPayload {
        return jwt.verify(token, this.jwtCfg.accessSecret) as JwtAccessPayload;
    }

    private signAccess(user: UserRecord): string {
        const payload: JwtAccessPayload = { sub: user.id, phone: user.phone, roles: user.roles };
        return jwt.sign(payload, this.jwtCfg.accessSecret, { expiresIn: this.jwtCfg.accessTtl });
    }

    private hash(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
