import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', async (_request, response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      memberships: { select: { choirId: true, vocalPart: true, availability: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return response.json(users);
});

router.patch('/:userId/role', requireAdmin, async (request: AuthRequest, response) => {
  const { role } = request.body ?? {};
  if (!role || !['MEMBER', 'LEADER', 'ADMIN'].includes(role)) {
    return response.status(400).json({ message: 'A valid role is required: MEMBER, LEADER, or ADMIN.' });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: String(request.params.userId) },
    select: { id: true, email: true, role: true },
  });

  if (!targetUser) {
    return response.status(404).json({ message: 'User not found.' });
  }

  if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
    return response.status(403).json({ message: 'Admin accounts are protected and cannot be changed to a normal role.' });
  }

  const user = await prisma.user.update({
    where: { id: String(request.params.userId) },
    data: { role },
    select: { id: true, name: true, email: true, role: true, createdAt: true, memberships: { select: { choirId: true, vocalPart: true, availability: true } } },
  });

  return response.json(user);
});

export default router;
