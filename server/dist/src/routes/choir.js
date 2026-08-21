"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/me', async (request, response) => {
    const memberships = await prisma_1.prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
    return response.json(memberships);
});
router.get('/:choirId/people', async (request, response) => {
    const members = await prisma_1.prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
    return response.json(members);
});
router.delete('/:choirId/people/:userId', auth_1.requireAdmin, async (request, response) => {
    await prisma_1.prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
    return response.status(204).send();
});
router.get('/:choirId/rehearsals', async (request, response) => {
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({ where: { choirId: request.params.choirId }, orderBy: { startsAt: 'asc' }, include: { attendances: true } });
    return response.json(rehearsals);
});
router.get('/:choirId/attendance/summary', async (request, response) => {
    const userId = request.userId;
    const choirId = String(request.params.choirId);
    const [total, confirmed, upcoming] = await Promise.all([
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
        prisma_1.prisma.rehearsal.count({ where: { choirId, startsAt: { gte: new Date() } } }),
    ]);
    return response.json({ total, confirmed, rate: total ? Math.round((confirmed / total) * 100) : 0, upcoming });
});
router.post('/:choirId/rehearsals', auth_1.requireAdmin, async (request, response) => {
    const { title, startsAt, endsAt, location } = request.body;
    if (!title || !startsAt || !endsAt || !location)
        return response.status(400).json({ message: 'Title, dates, and location are required.' });
    const rehearsal = await prisma_1.prisma.rehearsal.create({ data: { choirId: String(request.params.choirId), title, startsAt: new Date(startsAt), endsAt: new Date(endsAt), location } });
    return response.status(201).json(rehearsal);
});
router.post('/:choirId/rehearsals/:rehearsalId/attendance', async (request, response) => {
    const status = ['YES', 'MAYBE', 'NO', 'PENDING'].includes(request.body.status) ? request.body.status : request.body.present ? 'YES' : 'NO';
    const rehearsalId = String(request.params.rehearsalId);
    const userId = request.userId;
    const attendance = await prisma_1.prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId, userId } }, update: { status, present: status === 'YES' }, create: { rehearsalId, userId, status, present: status === 'YES' } });
    return response.json(attendance);
});
router.get('/:choirId/announcements', async (request, response) => {
    return response.json(await prisma_1.prisma.announcement.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { createdAt: 'desc' } }));
});
router.post('/:choirId/announcements', auth_1.requireAdmin, async (request, response) => {
    const { title, message, priority } = request.body;
    if (!title || !message)
        return response.status(400).json({ message: 'Title and message are required.' });
    const announcement = await prisma_1.prisma.announcement.create({ data: { choirId: String(request.params.choirId), title, message, priority: priority === 'IMPORTANT' ? 'IMPORTANT' : 'NORMAL' } });
    return response.status(201).json(announcement);
});
router.get('/:choirId/songs', async (request, response) => {
    return response.json(await prisma_1.prisma.song.findMany({ where: { choirId: request.params.choirId }, orderBy: { title: 'asc' } }));
});
exports.default = router;
