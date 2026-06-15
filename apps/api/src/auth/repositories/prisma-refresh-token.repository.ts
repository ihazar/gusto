import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRecord, RefreshTokenRepository } from '../ports';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(input: {
        userId: string;
        deviceId: string | null;
        tokenHash: string;
        expiresAt: Date;
    }): Promise<RefreshTokenRecord> {
        const row = await this.prisma.refreshToken.create({ data: input });
        return this.toRecord(row);
    }

    async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
        const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
        return row ? this.toRecord(row) : null;
    }

    async markRotated(id: string): Promise<void> {
        // Mark used-for-rotation but NOT revoked: presenting it again must reach the
        // reuse-detection branch in TokenService.rotate (which revokes the family).
        await this.prisma.refreshToken.update({
            where: { id },
            data: { rotatedAt: new Date() },
        });
    }

    async revoke(id: string): Promise<void> {
        await this.prisma.refreshToken.update({
            where: { id },
            data: { revokedAt: new Date() },
        });
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    private toRecord(row: {
        id: string;
        userId: string;
        deviceId: string | null;
        expiresAt: Date;
        revokedAt: Date | null;
        rotatedAt: Date | null;
    }): RefreshTokenRecord {
        return {
            id: row.id,
            userId: row.userId,
            deviceId: row.deviceId,
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
            rotatedAt: row.rotatedAt,
        };
    }
}
