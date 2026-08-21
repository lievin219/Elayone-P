import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();
const credentials = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function issueSession(user: { id: string; name: string; email: string; role: 'MEMBER' | 'LEADER' | 'ADMIN' }) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '30d' });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

router.post('/signup', async (request, response) => {
  const parsed = credentials.safeParse(request.body);
  if (!parsed.success || !parsed.data.name) return response.status(400).json({ message: parsed.success ? 'Please enter your full name.' : parsed.error.issues[0].message });
  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return response.status(409).json({ message: 'An account with that email already exists.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  return response.status(201).json(issueSession(user));
});

router.post('/login', async (request, response) => {
  const parsed = credentials.omit({ name: true }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0].message });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user && await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid || !user) return response.status(401).json({ message: 'Email or password is incorrect.' });
  return response.json(issueSession(user));
});

export default router;
