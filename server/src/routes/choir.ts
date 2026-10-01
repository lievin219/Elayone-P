import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireAdmin, requireChoirAccess } from '../middleware/auth';

const router = Router();

router.get('/me', async (request: AuthRequest, response) => {
  const memberships = await prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
  return response.json(memberships);
});

router.get('/:choirId/people', requireChoirAccess, async (request, response) => {
  const members = await prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
  return response.json(members);
});

router.delete('/:choirId/people/:userId', requireAdmin, async (request, response) => {
  await prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
  return response.status(204).send();
});

router.get('/:choirId/rehearsals', requireChoirAccess, async (request, response) => {
  const rehearsals = await prisma.rehearsal.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { startsAt: 'asc' }, include: { attendances: true } });
  return response.json(rehearsals);
});

router.get('/:choirId/attendance/summary', requireChoirAccess, async (request: AuthRequest, response) => {
  const userId = request.userId as string;
  const choirId = String(request.params.choirId);
  const [total, confirmed, upcoming] = await Promise.all([
    prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
    prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
    prisma.rehearsal.count({ where: { choirId, startsAt: { gte: new Date() } } }),
  ]);
  return response.json({ total, confirmed, rate: total ? Math.round((confirmed / total) * 100) : 0, upcoming });
});

router.get('/:choirId/attendance/report', requireChoirAccess, async (request: AuthRequest, response) => {
  const choirId = String(request.params.choirId);
  const userId = request.userId as string;
  const [viewer, choir] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.choir.findUnique({ where: { id: choirId }, select: { id: true } }),
  ]);
  if (!choir) return response.status(404).json({ message: 'Choir not found.' });

  const canViewAll = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
  const memberships = await prisma.membership.findMany({
    where: { choirId, ...(canViewAll ? {} : { userId }) },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  if (!canViewAll && memberships.length === 0) {
    return response.status(403).json({ message: 'You must be a member of this choir to view attendance.' });
  }

  const rehearsals = await prisma.rehearsal.findMany({
    where: { choirId },
    include: { attendances: { select: { userId: true, status: true } } },
    orderBy: { startsAt: 'desc' },
  });
  const members = memberships.map((membership) => {
    const events = rehearsals.map((rehearsal) => {
      const status = rehearsal.attendances.find((entry) => entry.userId === membership.userId)?.status ?? 'PENDING';
      return {
        rehearsalId: rehearsal.id,
        title: rehearsal.title,
        eventType: rehearsal.eventType,
        startsAt: rehearsal.startsAt.toISOString(),
        location: rehearsal.location,
        status,
      };
    });
    const yes = events.filter((event) => event.status === 'YES').length;
    const maybe = events.filter((event) => event.status === 'MAYBE').length;
    const no = events.filter((event) => event.status === 'NO').length;
    const pending = events.filter((event) => event.status === 'PENDING').length;
    const responded = yes + maybe + no;
    return {
      id: membership.user.id,
      name: membership.user.name,
      email: canViewAll ? membership.user.email : undefined,
      vocalPart: membership.vocalPart,
      stats: { yes, maybe, no, pending, responseRate: events.length ? Math.round((responded / events.length) * 100) : 0 },
      events,
    };
  });

  const total = members.length * rehearsals.length;
  const summary = members.reduce((counts, member) => ({
    yes: counts.yes + member.stats.yes,
    maybe: counts.maybe + member.stats.maybe,
    no: counts.no + member.stats.no,
    pending: counts.pending + member.stats.pending,
  }), { yes: 0, maybe: 0, no: 0, pending: 0 });
  const responded = summary.yes + summary.maybe + summary.no;
  const events = rehearsals.map((rehearsal) => {
    const responses = members.map((member) => ({
      userId: member.id,
      name: member.name,
      status: member.events.find((event) => event.rehearsalId === rehearsal.id)?.status ?? 'PENDING',
    }));
    return {
      id: rehearsal.id,
      title: rehearsal.title,
      eventType: rehearsal.eventType,
      startsAt: rehearsal.startsAt.toISOString(),
      location: rehearsal.location,
      totals: {
        yes: responses.filter((entry) => entry.status === 'YES').length,
        maybe: responses.filter((entry) => entry.status === 'MAYBE').length,
        no: responses.filter((entry) => entry.status === 'NO').length,
        pending: responses.filter((entry) => entry.status === 'PENDING').length,
      },
      responses,
    };
  });

  return response.json({
    scope: canViewAll ? 'choir' : 'member',
    generatedAt: new Date().toISOString(),
    summary: { members: members.length, rehearsals: rehearsals.length, total, ...summary, responseRate: total ? Math.round((responded / total) * 100) : 0 },
    events,
    members,
  });
});

router.post('/:choirId/rehearsals', requireAdmin, async (request, response) => {
  const { title, startsAt, endsAt, location, eventType } = request.body;
  if (!title || !startsAt || !endsAt || !location) return response.status(400).json({ message: 'Title, dates, and location are required.' });
  const normalizedType = ['SERVICE', 'REHEARSAL', 'WORSHIP_NIGHT', 'SPECIAL_EVENT'].includes(eventType) ? eventType : 'REHEARSAL';
  const rehearsal = await prisma.rehearsal.create({ data: { choirId: String(request.params.choirId), title, eventType: normalizedType, startsAt: new Date(startsAt), endsAt: new Date(endsAt), location } });
  return response.status(201).json(rehearsal);
});

router.post('/:choirId/rehearsals/:rehearsalId/attendance', requireChoirAccess, async (request: AuthRequest, response) => {
  const status = ['YES', 'MAYBE', 'NO', 'PENDING'].includes(request.body.status) ? request.body.status : request.body.present ? 'YES' : 'NO';
  const rehearsalId = String(request.params.rehearsalId);
  const userId = request.userId as string;
  const [membership, rehearsal] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_choirId: { userId, choirId: String(request.params.choirId) } } }),
    prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId: String(request.params.choirId) }, select: { id: true } }),
  ]);
  if (!membership || !rehearsal) return response.status(403).json({ message: 'You cannot respond to attendance for this choir event.' });
  const attendance = await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId, userId } }, update: { status, present: status === 'YES' }, create: { rehearsalId, userId, status, present: status === 'YES' } });
  return response.json(attendance);
});

router.get('/:choirId/announcements', requireChoirAccess, async (request, response) => {
  return response.json(await prisma.announcement.findMany({
    where: { choirId: String(request.params.choirId) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  }));
});

router.post('/:choirId/announcements', requireAdmin, async (request: AuthRequest, response) => {
  const { title, message, priority } = request.body;
  if (!title || !message) return response.status(400).json({ message: 'Title and message are required.' });
  const announcement = await prisma.announcement.create({
    data: {
      choirId: String(request.params.choirId),
      title,
      message,
      priority: priority === 'IMPORTANT' ? 'IMPORTANT' : 'NORMAL',
      authorId: request.userId,
    },
    include: { author: { select: { name: true } } },
  });
  return response.status(201).json(announcement);
});

router.delete('/:choirId/announcements/:announcementId', requireAdmin, async (request, response) => {
  await prisma.announcement.delete({
    where: {
      id: String(request.params.announcementId),
    },
  });
  return response.status(204).send();
});

router.get('/:choirId/songs', requireChoirAccess, async (request, response) => {
  return response.json(await prisma.song.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { title: 'asc' } }));
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
