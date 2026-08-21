"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
const credentials = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Please enter your full name.').optional(),
    email: zod_1.z.string().trim().email('Enter a valid email address.'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters.'),
});
function issueSession(user) {
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
router.post('/signup', async (request, response) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success || !parsed.data.name)
        return response.status(400).json({ message: parsed.success ? 'Please enter your full name.' : parsed.error.issues[0].message });
    const { name, email, password } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing)
        return response.status(409).json({ message: 'An account with that email already exists.' });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.create({ data: { name, email, passwordHash } });
    return response.status(201).json(issueSession(user));
});
router.post('/login', async (request, response) => {
    const parsed = credentials.omit({ name: true }).safeParse(request.body);
    if (!parsed.success)
        return response.status(400).json({ message: parsed.error.issues[0].message });
    const user = await prisma_1.prisma.user.findUnique({ where: { email: parsed.data.email } });
    const valid = user && await bcryptjs_1.default.compare(parsed.data.password, user.passwordHash);
    if (!valid || !user)
        return response.status(401).json({ message: 'Email or password is incorrect.' });
    return response.json(issueSession(user));
});
exports.default = router;
