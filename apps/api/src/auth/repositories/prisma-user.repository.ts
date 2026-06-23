import { Injectable } from '@nestjs/common';
import { UserRole } from '@gusto/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceInfo, UserRecord, UserRepository } from '../ports';

@Injectable()
export class PrismaUserRepository implements UserRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByPhone(phone: string): Promise<UserRecord | null> {
        const user = await this.prisma.user.findUnique({ where: { phone } });
        return user ? this.toRecord(user) : null;
    }

    async findById(id: string): Promise<UserRecord | null> {
        const user = await this.prisma.user.findUnique({ where: { id } });
        return user ? this.toRecord(user) : null;
    }

    async createCustomer(phone: string): Promise<UserRecord> {
        const user = await this.prisma.user.create({
            data: { phone, roles: [UserRole.CUSTOMER] },
        });
        return this.toRecord(user);
    }

    async upsertDevice(userId: string, device: DeviceInfo): Promise<void> {
        // deviceId is the primary key, so it's unique across all users. Match on
        // it directly and (re)assign ownership to whoever is logging in now — the
        // same physical install can be used by a different account over time.
        await this.prisma.device.upsert({
            where: { id: device.deviceId },
            create: {
                id: device.deviceId,
                userId,
                platform: device.platform,
                pushToken: device.pushToken,
            },
            update: { userId, platform: device.platform, pushToken: device.pushToken, lastSeenAt: new Date() },
        });
    }

    private toRecord(user: { id: string; phone: string; displayName: string | null; roles: string[] }): UserRecord {
        return {
            id: user.id,
            phone: user.phone,
            displayName: user.displayName,
            roles: user.roles as UserRole[],
        };
    }
}
