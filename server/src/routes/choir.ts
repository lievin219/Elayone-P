import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/me', async (request: AuthRequest, response) => {
  const memberships = await prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
  return response.json(memberships);
});

router.get('/:choirId/people', async (request, response) => {
  const members = await prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
  return response.json(members);
});

router.get('/:choirId/rehearsals', async (request, response) => {
  const rehearsals = await prisma.rehearsal.findMany({ where: { choirId: request.params.choirId }, orderBy: { startsAt: 'asc' }, include: { attendances: true } });
  return response.json(rehearsals);
});

router.post('/:choirId/rehearsals/:rehearsalId/attendance', async (request: AuthRequest, response) => {
  const status = ['YES', 'MAYBE', 'NO', 'PENDING'].includes(request.body.status) ? request.body.status : request.body.present ? 'YES' : 'NO';
  const rehearsalId = String(request.params.rehearsalId);
  const userId = request.userId as string;
  const attendance = await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId, userId } }, update: { status, present: status === 'YES' }, create: { rehearsalId, userId, status, present: status === 'YES' } });
  return response.json(attendance);
});

router.get('/:choirId/announcements', async (request, response) => {
  return response.json(await prisma.announcement.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { createdAt: 'desc' } }));
});

router.get('/:choirId/songs', async (request, response) => {
  return response.json(await prisma.song.findMany({ where: { choirId: request.params.choirId }, orderBy: { title: 'asc' } }));
});

export default router;
