"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = __importDefault(require("./routes/auth"));
const choir_1 = __importDefault(require("./routes/choir"));
const users_1 = __importDefault(require("./routes/users"));
const prisma_1 = require("./lib/prisma");
const auth_2 = require("./middleware/auth");
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET)
    throw new Error('DATABASE_URL and JWT_SECRET are required.');
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(node_path_1.default.resolve(process.cwd(), 'uploads')));
app.get('/health', (_request, response) => response.json({ ok: true, service: 'elayone-choir-api' }));
app.use('/api/auth', auth_1.default);
app.use('/api/choirs', auth_2.requireAuth, choir_1.default);
app.use('/api/users', auth_2.requireAuth, auth_2.requireAdmin, users_1.default);
// Self-service password change: any signed-in member can set/change their own
// password (they must supply their current password to prove identity).
app.patch('/api/me/password', auth_2.requireAuth, async (request, response) => {
    const { currentPassword, newPassword } = request.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        return response.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8)
        return response.status(400).json({ message: 'The new password must be at least 8 characters.' });
    const authRequest = request;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: authRequest.userId }, select: { id: true, name: true, passwordHash: true } });
    if (!user)
        return response.status(404).json({ message: 'User not found.' });
    const valid = user.passwordHash ? await bcryptjs_1.default.compare(currentPassword, user.passwordHash) : false;
    if (!valid)
        return response.status(401).json({ message: 'The current password is incorrect.' });
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcryptjs_1.default.hash(newPassword, 12) } });
    return response.json({ message: `Your password has been updated successfully.` });
});
app.use('/api/me', auth_2.requireAuth, async (request, response) => {
    response.setHeader('Allow', 'PATCH');
    return response.status(405).json({ message: 'Method PATCH is not allowed for this endpoint. Use /api/me/password.' });
});
const port = Number(process.env.PORT) || 4000;
app.listen(port, '0.0.0.0', () => {
    const interfaces = Object.values(node_os_1.default.networkInterfaces()).flat();
    const lanAddress = interfaces.find((networkInterface) => networkInterface?.family === 'IPv4' && !networkInterface.internal)?.address;
    console.log(`Elayone API listening locally at http://localhost:${port}`);
    console.log(`Mobile API URL: http://${lanAddress ?? '<your-computer-ip>'}:${port}`);
});
