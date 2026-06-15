import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { DevicePlatform, UserRole } from '@gusto/contracts';
import { AuthService } from '../src/auth/auth.service';
import { TokenService } from '../src/auth/token.service';
import { OtpThrottledError, OtpVerificationError } from '../src/auth/auth.errors';
import {
    DeviceInfo,
    OtpProvider,
    RateLimiter,
    RateLimitResult,
    RefreshTokenRecord,
    RefreshTokenRepository,
    UserRecord,
    UserRepository,
} from '../src/auth/ports';

// ── in-memory fakes ────────────────────────────────────────────────────
class FakeOtp implements OtpProvider {
    lastCode = '123456';
    sent: string[] = [];
    async sendCode(phone: string, _channel: 'sms' | 'whatsapp' = 'sms'): Promise<void> {
        this.sent.push(phone);
    }
    async verifyCode(_phone: string, code: string): Promise<boolean> {
        return code === this.lastCode;
    }
}

class FakeRateLimiter implements RateLimiter {
    constructor(private readonly max = 3) {}
    private counts = new Map<string, number>();
    async hit(key: string): Promise<RateLimitResult> {
        const n = (this.counts.get(key) ?? 0) + 1;
        this.counts.set(key, n);
        return { allowed: n <= this.max, resendAfter: 3600 };
    }
}

class FakeUsers implements UserRepository {
    private byId = new Map<string, UserRecord>();
    private byPhone = new Map<string, UserRecord>();
    devices: Array<{ userId: string; device: DeviceInfo }> = [];
    private seq = 0;
    async findByPhone(phone: string) {
        return this.byPhone.get(phone) ?? null;
    }
    async findById(id: string) {
        return this.byId.get(id) ?? null;
    }
    async createCustomer(phone: string): Promise<UserRecord> {
        const user: UserRecord = {
            id: `u${++this.seq}`,
            phone,
            displayName: null,
            roles: [UserRole.CUSTOMER],
        };
        this.byId.set(user.id, user);
        this.byPhone.set(phone, user);
        return user;
    }
    async upsertDevice(userId: string, device: DeviceInfo): Promise<void> {
        this.devices.push({ userId, device });
    }
}

class FakeRefreshTokens implements RefreshTokenRepository {
    private byId = new Map<string, RefreshTokenRecord>();
    private byHash = new Map<string, RefreshTokenRecord>();
    private seq = 0;
    async create(input: {
        userId: string;
        deviceId: string | null;
        tokenHash: string;
        expiresAt: Date;
    }): Promise<RefreshTokenRecord> {
        const rec: RefreshTokenRecord = {
            id: `rt${++this.seq}`,
            userId: input.userId,
            deviceId: input.deviceId,
            expiresAt: input.expiresAt,
            revokedAt: null,
            rotatedAt: null,
        };
        this.byId.set(rec.id, rec);
        this.byHash.set(input.tokenHash, rec);
        return rec;
    }
    async findByHash(tokenHash: string) {
        return this.byHash.get(tokenHash) ?? null;
    }
    async markRotated(id: string): Promise<void> {
        this.byId.get(id)!.rotatedAt = new Date();
    }
    async revoke(id: string): Promise<void> {
        this.byId.get(id)!.revokedAt = new Date();
    }
    async revokeAllForUser(userId: string): Promise<void> {
        for (const rec of this.byId.values()) {
            if (rec.userId === userId) rec.revokedAt = new Date();
        }
    }
}

const jwtConfig = {
    accessSecret: 'test-access',
    refreshSecret: 'test-refresh',
    accessTtl: 900,
    refreshTtl: 2_592_000,
};
const fakeConfig = { get: () => jwtConfig } as any as ConfigService<any, true>;
const authConfig = {
    get: () => ({ testCode: '', testPhones: [] as string[] }),
} as any as ConfigService<any, true>;

const device: DeviceInfo = { deviceId: 'dev-1', platform: DevicePlatform.IOS };

function build() {
    const otp = new FakeOtp();
    const users = new FakeUsers();
    const refreshTokens = new FakeRefreshTokens();
    const tokens = new TokenService(fakeConfig, refreshTokens, users);
    const auth = new AuthService(otp, new FakeRateLimiter(3), users, tokens, authConfig);
    return { auth, tokens, otp, users, refreshTokens };
}

// ── tests ──────────────────────────────────────────────────────────────
describe('phone-OTP auth flow', () => {
    const phone = '+14155552671';

    it('sends a code and acks generically', async () => {
        const { auth, otp } = build();
        const res = await auth.requestOtp(phone);
        expect(res.ok).toBe(true);
        expect(res.resendAfter).toBeGreaterThan(0);
        expect(otp.sent).toEqual([phone]);
    });

    it('throttles repeated OTP requests', async () => {
        const { auth } = build();
        await auth.requestOtp(phone);
        await auth.requestOtp(phone);
        await auth.requestOtp(phone);
        await expect(auth.requestOtp(phone)).rejects.toBeInstanceOf(OtpThrottledError);
    });

    it('rejects a wrong code', async () => {
        const { auth } = build();
        await expect(auth.verifyOtp({ phone, code: '000000', device })).rejects.toBeInstanceOf(OtpVerificationError);
    });

    it('creates the user on first verify and issues a token pair', async () => {
        const { auth, users } = build();
        const res = await auth.verifyOtp({ phone, code: '123456', device });

        expect(res.user.phone).toBe(phone);
        expect(res.user.roles).toContain(UserRole.CUSTOMER);
        expect(res.tokens.accessToken).toBeTruthy();
        expect(res.tokens.refreshToken).toBeTruthy();
        expect(res.tokens.expiresIn).toBe(900);
        expect(users.devices).toHaveLength(1);

        // access token decodes to the right subject
        const tokens = new TokenService(fakeConfig, new FakeRefreshTokens(), users);
        const payload = tokens.verifyAccess(res.tokens.accessToken);
        expect(payload.sub).toBe(res.user.id);
        expect(payload.phone).toBe(phone);
    });

    it('reuses the existing user on subsequent logins', async () => {
        const { auth } = build();
        const first = await auth.verifyOtp({ phone, code: '123456' });
        const second = await auth.verifyOtp({ phone, code: '123456' });
        expect(second.user.id).toBe(first.user.id);
    });

    it('rotates refresh tokens', async () => {
        const { auth } = build();
        const { tokens } = await auth.verifyOtp({ phone, code: '123456', device });
        const rotated = await auth.refresh(tokens.refreshToken);

        expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
        expect(rotated.tokens.accessToken).toBeTruthy();
    });

    it('detects reuse of a rotated refresh token and revokes the family', async () => {
        const { auth } = build();
        const { tokens } = await auth.verifyOtp({ phone, code: '123456', device });

        const rotated = await auth.refresh(tokens.refreshToken); // old token now rotated out

        // presenting the old (already-rotated) token is an attack
        await expect(auth.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
        // and the newly issued token is now revoked too
        await expect(auth.refresh(rotated.tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
});
