"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const newMemberSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Enter the member’s full name.'),
    email: zod_1.z.string().trim().email('Enter a valid email address.').transform((email) => email.toLowerCase()),
    password: zod_1.z.string().min(8, 'The temporary password must be at least 8 characters.'),
});
router.get('/', async (_request, response) => {
    const users = await prisma_1.prisma.user.findMany({
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
router.post('/', auth_1.requireAdmin, async (request, response) => {
    const parsed = newMemberSchema.safeParse(request.body);
    if (!parsed.success)
        return response.status(400).json({ message: parsed.error.issues[0].message });
    const { name, email, password } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing)
        return response.status(409).json({ message: 'An account already uses that email. Try signing in or enter a different address.' });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.$transaction(async (transaction) => {
        const choir = await transaction.choir.upsert({
            where: { id: 'elayone-main-choir' },
            update: {},
            create: { id: 'elayone-main-choir', name: 'Elayone Choir', description: 'A choir serving with one voice.' },
        });
        const created = await transaction.user.create({
            data: { name, email, passwordHash, role: 'MEMBER' },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        await transaction.membership.create({ data: { userId: created.id, choirId: choir.id } });
        return created;
    });
    return response.status(201).json({
        ...user,
        memberships: [{ choirId: 'elayone-main-choir', vocalPart: null, availability: 'PENDING' }],
    });
});
router.patch('/:userId/role', auth_1.requireAdmin, async (request, response) => {
    const { role } = request.body ?? {};
    if (!role || !['MEMBER', 'LEADER', 'ADMIN'].includes(role)) {
        return response.status(400).json({ message: 'A valid role is required: MEMBER, LEADER, or ADMIN.' });
    }
    const targetUser = await prisma_1.prisma.user.findUnique({
        where: { id: String(request.params.userId) },
        select: { id: true, email: true, role: true },
    });
    if (!targetUser) {
        return response.status(404).json({ message: 'User not found.' });
    }
    const protectedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const isProtectedAdmin = protectedAdminEmail && targetUser.email.toLowerCase() === protectedAdminEmail;
    if (isProtectedAdmin && role !== 'ADMIN') {
        return response.status(403).json({ message: 'The configured admin account is protected and cannot be changed to a normal role.' });
    }
    const user = await prisma_1.prisma.user.update({
        where: { id: String(request.params.userId) },
        data: { role },
        select: { id: true, name: true, email: true, role: true, createdAt: true, memberships: { select: { choirId: true, vocalPart: true, availability: true } } },
    });
    return response.json(user);
});
router.patch('/:userId/password', auth_1.requireAdmin, async (request, response) => {
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (password.length < 12)
        return response.status(400).json({ message: 'The new password must be at least 12 characters long and include a number and a symbol.' });
    const targetUser = await prisma_1.prisma.user.findUnique({ where: { id: String(request.params.userId) }, select: { id: true, name: true } });
    if (!targetUser)
        return response.status(404).json({ message: 'User not found.' });
    await prisma_1.prisma.user.update({ where: { id: targetUser.id }, data: { passwordHash: await bcryptjs_1.default.hash(password, 12) } });
    return response.json({ message: `Password reset for ${targetUser.name}.` });
});
router.patch('/:userId/password/self', async (request, response) => {
    const { currentPassword, newPassword } = request.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        return response.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8)
        return response.status(400).json({ message: 'The new password must be at least 8 characters.' });
    const targetUser = await prisma_1.prisma.user.findUnique({
        where: { id: String(request.params.userId) },
        select: { id: true, name: true, passwordHash: true },
    });
    if (!targetUser)
        return response.status(404).json({ message: 'User not found.' });
    const valid = targetUser.passwordHash ? await bcryptjs_1.default.compare(currentPassword, targetUser.passwordHash) : false;
    if (!valid)
        return response.status(401).json({ message: 'The current password is incorrect.' });
    await prisma_1.prisma.user.update({
        where: { id: targetUser.id },
        data: { passwordHash: await bcryptjs_1.default.hash(newPassword, 12) },
    });
    return response.json({ message: `Your password has been updated successfully.` });
});
exports.default = router;
