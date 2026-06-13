export interface AppConfig {
  env: string;
  port: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  otp: {
    provider: 'mock' | 'twilio';
    codeTtl: number;
    maxAttempts: number;
    requestWindow: number;
    maxRequestsPerWindow: number;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    verifyServiceSid: string;
  };
  redisUrl: string;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.API_PORT, 5000),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: num(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: num(process.env.JWT_REFRESH_TTL, 2_592_000),
  },
  otp: {
    provider: (process.env.OTP_PROVIDER as 'mock' | 'twilio') ?? 'mock',
    codeTtl: num(process.env.OTP_CODE_TTL, 300),
    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
    requestWindow: num(process.env.OTP_REQUEST_WINDOW, 3600),
    maxRequestsPerWindow: num(process.env.OTP_MAX_REQUESTS_PER_WINDOW, 5),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? '',
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:5004',
});
