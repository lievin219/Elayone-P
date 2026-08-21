"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
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
exports.default = router;
