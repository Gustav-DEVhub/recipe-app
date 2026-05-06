import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mealdbRouter from './routes/mealdb.js';

const app = express();

// Middleware hardening
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Dev-friendly CORS; in production set CORS_ORIGIN to your client URL.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ?? true
  })
);

// API routes (client must call only /api/*)
app.use('/api', mealdbRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
