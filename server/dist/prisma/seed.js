"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const passwordHash = await bcryptjs_1.default.hash('ChangeMe123!', 12);
    const choir = await prisma.choir.upsert({ where: { id: 'elayone-main-choir' }, update: {}, create: { id: 'elayone-main-choir', name: 'Elayone Choir', description: 'A choir serving with one voice.' } });
    const director = await prisma.user.upsert({ where: { email: 'director@elayone.org' }, update: {}, create: { name: 'Aline Mukamana', email: 'director@elayone.org', passwordHash, role: client_1.Role.ADMIN } });
    await prisma.membership.upsert({ where: { userId_choirId: { userId: director.id, choirId: choir.id } }, update: {}, create: { userId: director.id, choirId: choir.id, vocalPart: client_1.VocalPart.SOPRANO } });
    await prisma.song.createMany({ data: [{ choirId: choir.id, title: 'Great Is Thy Faithfulness', key: 'D', status: 'READY' }, { choirId: choir.id, title: 'Imbaraga Zayo', key: 'G', status: 'LEARN' }], skipDuplicates: true });
    const rehearsal = await prisma.rehearsal.upsert({ where: { id: 'elayone-first-rehearsal' }, update: {}, create: { id: 'elayone-first-rehearsal', choirId: choir.id, title: 'Sunday service set', startsAt: new Date('2025-08-18T18:00:00Z'), endsAt: new Date('2025-08-18T20:00:00Z'), location: 'Main sanctuary' } });
    await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId: rehearsal.id, userId: director.id } }, update: { status: 'YES', present: true }, create: { rehearsalId: rehearsal.id, userId: director.id, status: 'YES', present: true } });
    const announcementClient = prisma.announcement;
    await announcementClient.upsert({ where: { id: 'elayone-welcome-announcement' }, update: {}, create: { id: 'elayone-welcome-announcement', choirId: choir.id, title: 'Welcome to the new season', message: 'Please confirm your availability before each rehearsal.', priority: 'IMPORTANT' } });
    console.log('Seeded Elayone Choir. Login: director@elayone.org / ChangeMe123!');
}
main().finally(() => prisma.$disconnect());
