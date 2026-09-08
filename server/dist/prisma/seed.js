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
    const director = await prisma.user.upsert({ where: { email: 'test@gmail.com' }, update: {}, create: { name: 'Test user', email: 'test@gmail.com', passwordHash, role: client_1.Role.ADMIN } });
    await prisma.membership.upsert({ where: { userId_choirId: { userId: director.id, choirId: choir.id } }, update: {}, create: { userId: director.id, choirId: choir.id, vocalPart: client_1.VocalPart.SOPRANO } });
    const director2 = await prisma.user.upsert({ where: { email: "test2@gmail.com" }, update: {}, create: { name: "Test User 2", email: "test2@gmail.com", passwordHash, role: client_1.Role.LEADER } });
    await prisma.song.createMany({ data: [{ choirId: choir.id, title: 'Ni muzima', key: 'D', status: 'READY' }, { choirId: choir.id, title: 'Arera', key: 'G', status: 'LEARN' }], skipDuplicates: true });
    const rehearsal = await prisma.rehearsal.upsert({ where: { id: 'elayone-first-rehearsal' }, update: {}, create: { id: 'elayone-first-rehearsal', choirId: choir.id, title: 'Sunday service set', startsAt: new Date('2025-08-18T18:00:00Z'), endsAt: new Date('2025-08-18T20:00:00Z'), location: 'Main sanctuary' } });
    await prisma.attendance.upsert({ where: { rehearsalId_userId: { rehearsalId: rehearsal.id, userId: director.id } }, update: { status: 'YES', present: true }, create: { rehearsalId: rehearsal.id, userId: director.id, status: 'YES', present: true } });
    const announcementClient = prisma.announcement;
    await announcementClient.upsert({ where: { id: 'elayone-welcome-announcement' }, update: {}, create: { id: 'elayone-welcome-announcement for the team', choirId: choir.id, title: 'Welcome to the new season', message: 'Please confirm your availability before each rehearsal.', priority: 'IMPORTANT' } });
    console.log('Seeded Elayone Choir. Login: test@gmail.com / ChangeMe123!');
    console.log(director2.name, director2.email, director2.role);
}
main().finally(() => prisma.$disconnect());
