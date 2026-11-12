import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './lib/env';
import { errorHandler } from './middleware/errorHandler';
import adminRoutes from './routes/admin';
import appointmentRoutes from './routes/appointments';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notifications';
import providerRoutes from './routes/providers';
import serviceRoutes from './routes/services';
import slotRoutes from './routes/slots';
import userRoutes from './routes/users';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.clientOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/slots', slotRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(errorHandler);
  return app;
}
