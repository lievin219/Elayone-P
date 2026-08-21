"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
router.get('/me', async (request, response) => {
    const memberships = await prisma_1.prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
    return response.json(memberships);
});
router.get('/:choirId/people', async (request, response) => {
    const members = await prisma_1.prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
    return response.json(members);
});
router.get('/:choirId/rehearsals', async (request, response) => {
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({ where: { choirId: request.params.choirId }, orderBy: { startsAt: 'asc' }, include: { attendances: true } });
    return response.json(rehearsals);
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
router.get('/:choirId/songs', async (request, response) => {
    return response.json(await prisma_1.prisma.song.findMany({ where: { choirId: request.params.choirId }, orderBy: { title: 'asc' } }));
});
exports.default = router;
