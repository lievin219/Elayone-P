"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("./routes/auth"));
const choir_1 = __importDefault(require("./routes/choir"));
const auth_2 = require("./middleware/auth");
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET)
    throw new Error('DATABASE_URL and JWT_SECRET are required.');
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (_request, response) => response.json({ ok: true, service: 'elayone-choir-api' }));
app.use('/api/auth', auth_1.default);
app.use('/api/choirs', auth_2.requireAuth, choir_1.default);
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Elayone API listening on port ${port}`));
