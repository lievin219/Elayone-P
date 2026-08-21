import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth';
import choirRoutes from './routes/choir';
import { requireAuth } from './middleware/auth';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required.');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_request, response) => response.json({ ok: true, service: 'elayone-choir-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/choirs', requireAuth, choirRoutes);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`Elayone API listening on port ${port}`));
