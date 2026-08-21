"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
function requireAuth(request, response, next) {
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token)
        return response.status(401).json({ message: 'Authentication is required.' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        request.userId = payload.userId;
        return next();
    }
    catch {
        return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
}
async function requireAdmin(request, response, next) {
    if (!request.userId)
        return response.status(401).json({ message: 'Authentication is required.' });
    const user = await prisma_1.prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'LEADER'))
        return response.status(403).json({ message: 'Only choir leaders can perform this action.' });
    return next();
}
