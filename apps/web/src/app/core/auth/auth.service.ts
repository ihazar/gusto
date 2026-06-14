import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AuthResponse,
  AuthTokens,
  AuthUser,
  DevicePlatform,
  OtpChannel,
  RequestOtpResponse,
} from '@gusto/contracts';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'gusto.auth';

interface StoredAuth {
  user: AuthUser;
  tokens: AuthTokens;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.apiUrl;
  private readonly state = signal<StoredAuth | null>(this.restore());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);

  constructor(private readonly http: HttpClient) {}

  /** Step 1: send a one-time code to the phone number over SMS or WhatsApp. */
  requestOtp(phone: string, channel: OtpChannel = 'sms'): Promise<RequestOtpResponse> {
    return firstValueFrom(
      this.http.post<RequestOtpResponse>(`${this.base}/auth/otp/request`, { phone, channel }),
    );
  }

  /** Step 2: verify the code, persist tokens, return the signed-in user. */
  async verifyOtp(phone: string, code: string): Promise<AuthUser> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.base}/auth/otp/verify`, {
        phone,
        code,
        device: { deviceId: this.deviceId(), platform: DevicePlatform.WEB },
      }),
    );
    this.persist(res);
    return res.user;
  }

  async logout(): Promise<void> {
    const token = this.state()?.tokens.refreshToken;
    if (token) {
      await firstValueFrom(
        this.http.post(`${this.base}/auth/logout`, { refreshToken: token }),
      ).catch(() => void 0);
    }
    this.state.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  accessToken(): string | null {
    return this.state()?.tokens.accessToken ?? null;
  }

  private persist(res: AuthResponse): void {
    const stored: StoredAuth = { user: res.user, tokens: res.tokens };
    this.state.set(stored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  private restore(): StoredAuth | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  }

  private deviceId(): string {
    let id = localStorage.getItem('gusto.deviceId');
    if (!id) {
      id = this.randomId();
      localStorage.setItem('gusto.deviceId', id);
    }
    return id;
  }

  /** UUID-ish id that also works in insecure (http) contexts where
   *  crypto.randomUUID() is unavailable. */
  private randomId(): string {
    const c = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const b = c.getRandomValues(new Uint8Array(16));
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
