import { Router } from 'express';
import { prisma } from '../lib/prisma';

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

export default router;
