import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AuthResponse,
  AuthTokens,
  AuthUser,
  DevicePlatform,
  RequestOtpResponse,
} from '@hearth/contracts';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'hearth.auth';

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

  /** Step 1: send a one-time code to the phone number. */
  requestOtp(phone: string): Promise<RequestOtpResponse> {
    return firstValueFrom(
      this.http.post<RequestOtpResponse>(`${this.base}/auth/otp/request`, { phone }),
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
    let id = localStorage.getItem('hearth.deviceId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('hearth.deviceId', id);
    }
    return id;
  }
}
