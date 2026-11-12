import dotenv from 'dotenv';

dotenv.config();

const rawClientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
  clientOrigins: [
    ...rawClientUrl
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
    ...(vercelOrigin ? [vercelOrigin] : []),
  ],
  cancellationMinHours: Number(process.env.CANCELLATION_MIN_HOURS ?? 2),
  isProd: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
  crossOriginCookies: process.env.CROSS_ORIGIN_COOKIES === 'true',
};
