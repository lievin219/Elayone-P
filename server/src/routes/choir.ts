import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/me', async (request: AuthRequest, response) => {
  const memberships = await prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
  return response.json(memberships);
});

router.get('/:choirId/people', async (request, response) => {
  const members = await prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
  return response.json(members);
});

router.delete('/:choirId/people/:userId', requireAdmin, async (request, response) => {
  await prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
  return response.status(204).send();
});

router.get('/:choirId/rehearsals', async (request, response) => {
  const rehearsals = await prisma.rehearsal.findMany({ where: { choirId: request.params.choirId }, orderBy: { startsAt: 'asc' }, include: { attendances: true } });
  return response.json(rehearsals);
});

router.get('/:choirId/attendance/summary', async (request: AuthRequest, response) => {
  const userId = request.userId as string;
  const choirId = String(request.params.choirId);
  const [total, confirmed, upcoming] = await Promise.all([
    prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
    prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
    prisma.rehearsal.count({ where: { choirId, startsAt: { gte: new Date() } } }),
  ]);
  return response.json({ total, confirmed, rate: total ? Math.round((confirmed / total) * 100) : 0, upcoming });
});

router.post('/:choirId/rehearsals', requireAdmin, async (request, response) => {
  const { title, startsAt, endsAt, location } = request.body;
  if (!title || !startsAt || !endsAt || !location) return response.status(400).json({ message: 'Title, dates, and location are required.' });
  const rehearsal = await prisma.rehearsal.create({ data: { choirId: String(request.params.choirId), title, startsAt: new Date(startsAt), endsAt: new Date(endsAt), location } });
  return response.status(201).json(rehearsal);
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

router.post('/:choirId/announcements', requireAdmin, async (request, response) => {
  const { title, message, priority } = request.body;
  if (!title || !message) return response.status(400).json({ message: 'Title and message are required.' });
  const announcement = await prisma.announcement.create({ data: { choirId: String(request.params.choirId), title, message, priority: priority === 'IMPORTANT' ? 'IMPORTANT' : 'NORMAL' } });
  return response.status(201).json(announcement);
});

router.get('/:choirId/songs', async (request, response) => {
  return response.json(await prisma.song.findMany({ where: { choirId: request.params.choirId }, orderBy: { title: 'asc' } }));
});

router.post('/:choirId/songs', requireAdmin, async (request, response) => {
  const { title, key, status, notes, previewUrl } = request.body;
  if (!title || !title.trim()) return response.status(400).json({ message: 'Song title is required.' });
  const song = await prisma.song.create({
    data: {
      choirId: String(request.params.choirId),
      title: String(title).trim(),
      key: key ? String(key).trim() : null,
      status: status === 'READY' || status === 'LEARN' ? status : 'LEARN',
      notes: notes ? String(notes).trim() : null,
      previewUrl: previewUrl ? String(previewUrl).trim() : null,
    },
  });
  return response.status(201).json(song);
});

export default router;
