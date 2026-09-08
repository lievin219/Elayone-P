import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import os from 'node:os';
import authRoutes from './routes/auth';
import choirRoutes from './routes/choir';
import userRoutes from './routes/users';
import { requireAdmin, requireAuth } from './middleware/auth';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required.');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_request, response) => response.json({ ok: true, service: 'elayone-choir-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/choirs', requireAuth, choirRoutes);
app.use('/api/users', requireAuth, requireAdmin, userRoutes);

const port = Number(process.env.PORT) || 4000;

app.listen(port, '0.0.0.0', () => {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const lanAddress = interfaces.find((networkInterface) => networkInterface?.family === 'IPv4' && !networkInterface.internal)?.address;
  console.log(`Elayone API listening locally at http://localhost:${port}`);
  console.log(`Mobile API URL: http://${lanAddress ?? '<your-computer-ip>'}:${port}`);
});