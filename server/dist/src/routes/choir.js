"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const uploadDirectory = node_path_1.default.resolve(process.cwd(), 'uploads');
node_fs_1.default.mkdirSync(uploadDirectory, { recursive: true });
const mediaUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: uploadDirectory,
        filename: (_request, file, callback) => callback(null, `${node_crypto_1.default.randomUUID()}${node_path_1.default.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => callback(null, ['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(file.mimetype)),
});
const uploadMedia = (request, response, next) => {
    mediaUpload.single('media')(request, response, (error) => {
        if (error instanceof multer_1.default.MulterError && error.code === 'LIMIT_FILE_SIZE')
            return response.status(413).json({ message: 'The media file is too large. Maximum size is 100 MB.' });
        if (error)
            return response.status(400).json({ message: 'Only MP3 and MP4 media files are supported.' });
        return next();
    });
};
function serializeEventSongs(eventSongs) {
    return eventSongs.map((entry) => ({
        id: entry.song.id,
        title: entry.song.title,
        key: entry.song.key,
        status: entry.song.status,
        sortOrder: entry.sortOrder,
    }));
}
const eventSongInclude = { orderBy: { sortOrder: 'asc' }, include: { song: { select: { id: true, title: true, key: true, status: true } } } };
router.get('/me', async (request, response) => {
    const memberships = await prisma_1.prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
    return response.json(memberships);
});
router.get('/:choirId/people', auth_1.requireChoirAccess, async (request, response) => {
    const members = await prisma_1.prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
    return response.json(members);
});
router.delete('/:choirId/people/:userId', auth_1.requireAdmin, async (request, response) => {
    await prisma_1.prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
    return response.status(204).send();
});
router.get('/:choirId/rehearsals', auth_1.requireChoirAccess, async (request, response) => {
    const userId = request.userId;
    const choirId = String(request.params.choirId);
    const viewer = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId },
        orderBy: { startsAt: 'asc' },
        include: {
            attendances: { select: { userId: true, status: true } },
            invitations: { include: { user: { select: { id: true, name: true } } } },
            eventSongs: eventSongInclude,
        },
    });
    const choirMembers = canManage ? await prisma_1.prisma.membership.findMany({
        where: { choirId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: 'asc' } },
    }) : [];
    const visibleEvents = rehearsals.filter((event) => canManage || event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId));
    return response.json(visibleEvents.map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.eventType,
        customEventType: event.customEventType,
        eventTypeName: event.customEventType ?? event.eventType,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceIndex: event.recurrenceIndex,
        recurrenceTotal: event.recurrenceTotal,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        createdAt: event.createdAt,
        invitationOnly: event.invitations.length > 0,
        invited: event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId),
        myStatus: event.attendances.find((attendance) => attendance.userId === userId)?.status ?? 'PENDING',
        confirmedCount: event.attendances.filter((attendance) => attendance.status === 'YES').length,
        songs: serializeEventSongs(event.eventSongs),
        invitees: canManage ? (event.invitations.length > 0
            ? event.invitations.map((invitation) => ({ userId: invitation.userId, name: invitation.user.name }))
            : choirMembers.map((member) => ({ userId: member.user.id, name: member.user.name }))).map((invitee) => ({
            ...invitee,
            status: event.attendances.find((attendance) => attendance.userId === invitee.userId)?.status ?? 'PENDING',
        })) : undefined,
    })));
});
router.get('/:choirId/attendance/summary', auth_1.requireChoirAccess, async (request, response) => {
    const userId = request.userId;
    const choirId = String(request.params.choirId);
    const [total, confirmed, upcoming] = await Promise.all([
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
        prisma_1.prisma.rehearsal.count({ where: { choirId, startsAt: { gte: new Date() } } }),
    ]);
    return response.json({ total, confirmed, rate: total ? Math.round((confirmed / total) * 100) : 0, upcoming });
});
router.get('/:choirId/attendance/report', auth_1.requireChoirAccess, async (request, response) => {
    const choirId = String(request.params.choirId);
    const userId = request.userId;
    const [viewer, choir] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        prisma_1.prisma.choir.findUnique({ where: { id: choirId }, select: { id: true } }),
    ]);
    if (!choir)
        return response.status(404).json({ message: 'Choir not found.' });
    const canViewAll = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const memberships = await prisma_1.prisma.membership.findMany({
        where: { choirId, ...(canViewAll ? {} : { userId }) },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: 'asc' } },
    });
    if (!canViewAll && memberships.length === 0) {
        return response.status(403).json({ message: 'You must be a member of this choir to view attendance.' });
    }
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId },
        include: {
            attendances: { select: { userId: true, status: true } },
            invitations: { select: { userId: true } },
        },
        orderBy: { startsAt: 'desc' },
    });
    const members = memberships.map((membership) => {
        const events = rehearsals.flatMap((rehearsal) => {
            const inviteeIds = rehearsal.invitations.map((invitation) => invitation.userId);
            if (inviteeIds.length > 0 && !inviteeIds.includes(membership.userId))
                return [];
            const status = rehearsal.attendances.find((entry) => entry.userId === membership.userId)?.status ?? 'PENDING';
            return [{
                    rehearsalId: rehearsal.id,
                    title: rehearsal.title,
                    eventType: rehearsal.eventType,
                    customEventType: rehearsal.customEventType,
                    eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
                    recurrenceFrequency: rehearsal.recurrenceFrequency,
                    recurrenceIndex: rehearsal.recurrenceIndex,
                    recurrenceTotal: rehearsal.recurrenceTotal,
                    startsAt: rehearsal.startsAt.toISOString(),
                    location: rehearsal.location,
                    status,
                }];
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
    const total = members.reduce((count, member) => count + member.events.length, 0);
    const summary = members.reduce((counts, member) => ({
        yes: counts.yes + member.stats.yes,
        maybe: counts.maybe + member.stats.maybe,
        no: counts.no + member.stats.no,
        pending: counts.pending + member.stats.pending,
    }), { yes: 0, maybe: 0, no: 0, pending: 0 });
    const responded = summary.yes + summary.maybe + summary.no;
    const events = rehearsals.map((rehearsal) => {
        const responses = members.flatMap((member) => {
            const memberEvent = member.events.find((event) => event.rehearsalId === rehearsal.id);
            return memberEvent ? [{ userId: member.id, name: member.name, status: memberEvent.status }] : [];
        });
        return {
            id: rehearsal.id,
            title: rehearsal.title,
            eventType: rehearsal.eventType,
            customEventType: rehearsal.customEventType,
            eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
            recurrenceFrequency: rehearsal.recurrenceFrequency,
            recurrenceIndex: rehearsal.recurrenceIndex,
            recurrenceTotal: rehearsal.recurrenceTotal,
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
router.post('/:choirId/rehearsals', auth_1.requireAdmin, async (request, response) => {
    const { title, startsAt, endsAt, location, eventType, customEventType, recurrenceFrequency, recurrenceCount, inviteeIds, songIds } = request.body;
    if (!title || !startsAt || !endsAt || !location)
        return response.status(400).json({ message: 'Title, dates, and location are required.' });
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        return response.status(400).json({ message: 'Enter a valid event start and end time; the end must be after the start.' });
    }
    if (inviteeIds !== undefined && (!Array.isArray(inviteeIds) || inviteeIds.length === 0 || inviteeIds.some((id) => typeof id !== 'string'))) {
        return response.status(400).json({ message: 'Select at least one choir member to invite, or omit inviteeIds for the whole choir.' });
    }
    if (songIds !== undefined && (!Array.isArray(songIds) || songIds.some((id) => typeof id !== 'string'))) {
        return response.status(400).json({ message: 'Choose songs from the choir library, or omit songIds to create the event without a setlist.' });
    }
    if (eventType === 'CUSTOM' && (!customEventType || typeof customEventType !== 'string' || !customEventType.trim())) {
        return response.status(400).json({ message: 'Enter a name for the custom event type.' });
    }
    const frequencies = ['NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'];
    const normalizedFrequency = frequencies.includes(recurrenceFrequency) ? recurrenceFrequency : 'NONE';
    const count = recurrenceCount === undefined ? 1 : Number(recurrenceCount);
    if (!Number.isInteger(count) || count < 1 || count > 52) {
        return response.status(400).json({ message: 'Recurring events must have between 1 and 52 occurrences.' });
    }
    const choirId = String(request.params.choirId);
    const selectedInviteeIds = inviteeIds === undefined ? [] : [...new Set(inviteeIds)];
    const selectedSongIds = songIds === undefined ? [] : [...new Set(songIds)];
    if (selectedInviteeIds.length > 0) {
        const memberships = await prisma_1.prisma.membership.findMany({ where: { choirId, userId: { in: selectedInviteeIds } }, select: { userId: true } });
        if (memberships.length !== selectedInviteeIds.length)
            return response.status(400).json({ message: 'Every invitee must be an active member of this choir.' });
    }
    if (selectedSongIds.length > 0) {
        const choirSongs = await prisma_1.prisma.song.findMany({ where: { choirId, id: { in: selectedSongIds } }, select: { id: true } });
        if (choirSongs.length !== selectedSongIds.length)
            return response.status(400).json({ message: 'Every selected song must belong to this choir’s library.' });
    }
    const normalizedType = ['SERVICE', 'REHEARSAL', 'WORSHIP_NIGHT', 'SPECIAL_EVENT'].includes(eventType) ? eventType : 'REHEARSAL';
    const normalizedCustomType = eventType === 'CUSTOM' ? String(customEventType).trim().slice(0, 80) : null;
    const rehearsal = await prisma_1.prisma.$transaction(async (transaction) => {
        let firstCreated = null;
        for (let index = 0; index < count; index += 1) {
            const startsAtDate = new Date(startDate);
            const endsAtDate = new Date(endDate);
            if (normalizedFrequency === 'WEEKLY') {
                startsAtDate.setDate(startsAtDate.getDate() + index * 7);
                endsAtDate.setDate(endsAtDate.getDate() + index * 7);
            }
            else if (normalizedFrequency === 'BIWEEKLY') {
                startsAtDate.setDate(startsAtDate.getDate() + index * 14);
                endsAtDate.setDate(endsAtDate.getDate() + index * 14);
            }
            else if (normalizedFrequency === 'MONTHLY') {
                startsAtDate.setMonth(startsAtDate.getMonth() + index);
                endsAtDate.setMonth(endsAtDate.getMonth() + index);
            }
            const created = await transaction.rehearsal.create({ data: { choirId, title: String(title).trim(), eventType: normalizedType, customEventType: normalizedCustomType, recurrenceFrequency: normalizedFrequency, recurrenceIndex: index + 1, recurrenceTotal: count, startsAt: startsAtDate, endsAt: endsAtDate, location: String(location).trim() } });
            if (!firstCreated)
                firstCreated = created;
            if (selectedInviteeIds.length > 0) {
                await transaction.eventInvitation.createMany({ data: selectedInviteeIds.map((userId) => ({ rehearsalId: created.id, userId })) });
            }
            if (selectedSongIds.length > 0) {
                await transaction.eventSong.createMany({ data: selectedSongIds.map((songId, songIndex) => ({ rehearsalId: created.id, songId, sortOrder: songIndex })) });
            }
        }
        if (!firstCreated)
            throw new Error('Could not create event.');
        return {
            ...firstCreated,
            invitations: await transaction.eventInvitation.findMany({ where: { rehearsalId: firstCreated.id }, include: { user: { select: { id: true, name: true } } } }),
            eventSongs: await transaction.eventSong.findMany({ where: { rehearsalId: firstCreated.id }, ...eventSongInclude }),
        };
    });
    return response.status(201).json({
        id: rehearsal.id,
        title: rehearsal.title,
        eventType: rehearsal.eventType,
        customEventType: rehearsal.customEventType,
        eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
        location: rehearsal.location,
        startsAt: rehearsal.startsAt,
        endsAt: rehearsal.endsAt,
        invitationOnly: rehearsal.invitations.length > 0,
        invited: true,
        myStatus: 'PENDING',
        confirmedCount: 0,
        songs: serializeEventSongs(rehearsal.eventSongs),
        invitees: rehearsal.invitations.map((invitation) => ({ userId: invitation.userId, name: invitation.user.name, status: 'PENDING' })),
    });
});
router.post('/:choirId/rehearsals/:rehearsalId/attendance', auth_1.requireChoirAccess, async (request, response) => {
    const status = ['YES', 'MAYBE', 'NO', 'PENDING'].includes(request.body.status) ? request.body.status : request.body.present ? 'YES' : 'NO';
    const rehearsalId = String(request.params.rehearsalId);
    const userId = request.userId;
    const [membership, rehearsal] = await Promise.all([
        prisma_1.prisma.membership.findUnique({ where: { userId_choirId: { userId, choirId: String(request.params.choirId) } } }),
        prisma_1.prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId: String(request.params.choirId) }, include: { invitations: { where: { userId }, select: { id: true } } } }),
    ]);
    if (!membership || !rehearsal)
        return response.status(403).json({ message: 'You cannot respond to attendance for this choir event.' });
    if (rehearsal.endsAt.getTime() < Date.now())
        return response.status(410).json({ message: 'This event has ended, so its attendance response is closed.' });
    const invitationCount = await prisma_1.prisma.eventInvitation.count({ where: { rehearsalId } });
    if (invitationCount > 0 && rehearsal.invitations.length === 0)
        return response.status(403).json({ message: 'This event is invitation-only, and you were not invited.' });
    const attendance = await prisma_1.prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId, userId } }, update: { status, present: status === 'YES' }, create: { rehearsalId, userId, status, present: status === 'YES' } });
    return response.json(attendance);
});
router.get('/:choirId/announcements', auth_1.requireChoirAccess, async (request, response) => {
    return response.json(await prisma_1.prisma.announcement.findMany({
        where: { choirId: String(request.params.choirId) },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
    }));
});
router.get('/:choirId/reminders', auth_1.requireChoirAccess, async (request, response) => {
    const choirId = String(request.params.choirId);
    const userId = request.userId;
    const viewer = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId, startsAt: { gte: now, lte: horizon } },
        include: {
            attendances: { select: { userId: true, status: true } },
            invitations: { select: { userId: true } },
        },
        orderBy: { startsAt: 'asc' },
    });
    const reminders = events.flatMap((event) => {
        const invited = event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId);
        if (!canManage && !invited)
            return [];
        const hoursUntil = Math.max(0, Math.round((event.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000)));
        const eventLabel = event.customEventType ?? event.eventType.replace('_', ' ');
        const pending = event.attendances.filter((attendance) => attendance.status === 'PENDING');
        const accepted = event.attendances.filter((attendance) => attendance.status === 'YES').length;
        const declined = event.attendances.filter((attendance) => attendance.status === 'NO').length;
        const results = [{
                id: `event-${event.id}-${userId}`,
                kind: 'EVENT',
                title: `${event.title} is coming up`,
                message: `${eventLabel} starts ${hoursUntil < 24 ? `in ${hoursUntil} hour${hoursUntil === 1 ? '' : 's'}` : `on ${event.startsAt.toLocaleDateString()}`} at ${event.location}.`,
                priority: hoursUntil < 24 ? 'IMPORTANT' : 'NORMAL',
                createdAt: now.toISOString(),
                eventId: event.id,
            }];
        if (canManage) {
            results.push({
                id: `response-${event.id}-${userId}`,
                kind: 'RESPONSE',
                title: `${event.title} attendance`,
                message: `${accepted} accepted, ${declined} declined, ${pending.length} still awaiting a response.`,
                priority: pending.length > 0 ? 'IMPORTANT' : 'NORMAL',
                createdAt: now.toISOString(),
                eventId: event.id,
            });
        }
        else if (event.attendances.find((attendance) => attendance.userId === userId)?.status === undefined) {
            results.push({
                id: `reply-${event.id}-${userId}`,
                kind: 'RESPONSE',
                title: `Respond to ${event.title}`,
                message: 'Please accept, choose maybe, or decline this event.',
                priority: 'IMPORTANT',
                createdAt: now.toISOString(),
                eventId: event.id,
            });
        }
        return results;
    });
    return response.json(reminders);
});
router.post('/:choirId/announcements', auth_1.requireAdmin, async (request, response) => {
    const { title, message, priority } = request.body;
    if (!title || !message)
        return response.status(400).json({ message: 'Title and message are required.' });
    const announcement = await prisma_1.prisma.announcement.create({
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
router.delete('/:choirId/announcements/:announcementId', auth_1.requireAdmin, async (request, response) => {
    await prisma_1.prisma.announcement.delete({
        where: {
            id: String(request.params.announcementId),
        },
    });
    return response.status(204).send();
});
router.get('/:choirId/songs', auth_1.requireChoirAccess, async (request, response) => {
    return response.json(await prisma_1.prisma.song.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { title: 'asc' } }));
});
router.post('/:choirId/songs', auth_1.requireAdmin, uploadMedia, async (request, response) => {
    const { title, key, status, notes, previewUrl } = request.body;
    if (!title || !title.trim())
        return response.status(400).json({ message: 'Song title is required.' });
    if (!request.file && !previewUrl)
        return response.status(400).json({ message: 'Attach an MP3 or MP4 file, or provide a preview URL.' });
    if (request.file && !['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(request.file.mimetype))
        return response.status(400).json({ message: 'Only MP3 and MP4 files are supported.' });
    const uploadedUrl = request.file ? `${request.protocol}://${request.get('host')}/uploads/${request.file.filename}` : null;
    const song = await prisma_1.prisma.song.create({
        data: {
            choirId: String(request.params.choirId),
            title: String(title).trim(),
            key: key ? String(key).trim() : null,
            status: status === 'READY' || status === 'LEARN' ? status : 'LEARN',
            notes: notes ? String(notes).trim() : null,
            previewUrl: uploadedUrl ?? (previewUrl ? String(previewUrl).trim() : null),
        },
    });
    return response.status(201).json(song);
});
router.delete('/:choirId/songs/:songId', auth_1.requireAdmin, async (request, response) => {
    const song = await prisma_1.prisma.song.findFirst({ where: { id: String(request.params.songId), choirId: String(request.params.choirId) } });
    if (!song)
        return response.status(404).json({ message: 'Song not found.' });
    await prisma_1.prisma.song.delete({ where: { id: song.id } });
    if (song.previewUrl?.includes('/uploads/')) {
        const filename = song.previewUrl.split('/uploads/')[1];
        if (filename && !filename.includes('/') && !filename.includes('..'))
            node_fs_1.default.rmSync(node_path_1.default.join(uploadDirectory, filename), { force: true });
    }
    return response.status(204).send();
});
exports.default = router;
