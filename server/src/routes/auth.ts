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

router.post('/signup', async (_request, response) => {
  return response.status(403).json({ message: 'Member accounts are created by a choir administrator. Please ask your administrator for an account.' });
});

router.post('/login', async (request, response) => {
  const parsed = credentials.omit({ name: true }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: parsed.error.issues[0].message });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return response.status(404).json({ message: 'No account was found for that email. Check the address or ask your choir administrator to create an account.' });
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return response.status(401).json({ message: 'That password is incorrect. Check it and try again, or ask your choir administrator to reset it.' });
  return response.json(issueSession(user));
});

export default router;
