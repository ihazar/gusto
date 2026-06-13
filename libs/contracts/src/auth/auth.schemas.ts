import { z } from 'zod';
import { DevicePlatform } from '../common/enums';

/** E.164: + followed by up to 15 digits (first 1-9). */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be E.164, e.g. +14155552671');

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Code must be 6 digits');

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  device: z
    .object({
      deviceId: z.string().min(1).max(128),
      platform: z.nativeEnum(DevicePlatform),
      pushToken: z.string().max(512).optional(),
    })
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RequestOtpDto = z.infer<typeof requestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type LogoutDto = z.infer<typeof logoutSchema>;
