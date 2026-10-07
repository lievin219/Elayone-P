import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import os from 'node:os';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth';
import choirRoutes from './routes/choir';
import userRoutes from './routes/users';
import { prisma } from './lib/prisma';
import { requireAdmin, requireAuth } from './middleware/auth';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required.');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.get('/health', (_request, response) => response.json({ ok: true, service: 'elayone-choir-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/choirs', requireAuth, choirRoutes);
app.use('/api/users', requireAuth, requireAdmin, userRoutes);

// Self-service password change: any signed-in member can set/change their own
// password (they must supply their current password to prove identity).
app.patch('/api/me/password', requireAuth, async (request, response) => {
  const { currentPassword, newPassword } = request.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return response.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 8) return response.status(400).json({ message: 'The new password must be at least 8 characters.' });
  const authRequest = request as import('./middleware/auth').AuthRequest;
  const user = await prisma.user.findUnique({ where: { id: authRequest.userId }, select: { id: true, name: true, passwordHash: true } });
  if (!user) return response.status(404).json({ message: 'User not found.' });
  const valid = user.passwordHash ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
  if (!valid) return response.status(401).json({ message: 'The current password is incorrect.' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  return response.json({ message: `Your password has been updated successfully.` });
});

app.use('/api/me', requireAuth, async (request, response) => {
  response.setHeader('Allow', 'PATCH');
  return response.status(405).json({ message: 'Method PATCH is not allowed for this endpoint. Use /api/me/password.' });
});

const port = Number(process.env.PORT) || 4000;

app.listen(port, '0.0.0.0', () => {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const lanAddress = interfaces.find((networkInterface) => networkInterface?.family === 'IPv4' && !networkInterface.internal)?.address;
  console.log(`Elayone API listening locally at http://localhost:${port}`);
  console.log(`Mobile API URL: http://${lanAddress ?? '<your-computer-ip>'}:${port}`);
});
