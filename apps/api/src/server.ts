import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import router from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { globalLimiter } from './middleware/rate-limit.middleware';
import { initScheduler } from './jobs/scheduler';
import { prisma, ensureDbMigrated } from './lib/prisma';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Dynamic DB Migration Middleware ──────────────────────────
app.use(async (_req, _res, next) => {
  try {
    await ensureDbMigrated();
  } catch (err) {
    console.error('Migration middleware error:', err);
  }
  next();
});

const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGIN_2,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://tourmaline-sherbet-90125b.netlify.app',
  'https://lifequest2-web.vercel.app',
].filter(Boolean) as string[];

// ─── Seguridad ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Root endpoint landing response
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'LifeQuest API',
    version: '2.0.0',
    status: 'online',
    health: '/health',
    endpoints: '/api/v1',
    message: '⚔️ ¡Bienvenido a la API de LifeQuest, héroe!',
  });
});

// Root-level health check (for Railway healthcheck probe)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Database connection check and schema sync
app.get('/api/v1/db/push', async (_req, res) => {
  try {
    const { execSync } = await import('child_process');
    const output = execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8' });
    res.json({ status: 'success', output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB push failed';
    res.status(500).json({ error: msg });
  }
});

// ─── Parsing ─────────────────────────────────────────────────────────────────
// Las fotos (perfil y gremio) viajan como data URL JPEG: 100 kB por defecto se queda corto.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Rate limiting global ────────────────────────────────────────────────────
app.use('/api/v1', globalLimiter);

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ─── Error handling ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log('');
    console.log('  ╔════════════════════════════════════╗');
    console.log('  ║  ⚔️  LifeQuest API  •  v2.0.0      ║');
    console.log(`  ║  🏰 http://localhost:${PORT}/api/v1   ║`);
    console.log('  ╚════════════════════════════════════╝');
    console.log('');
    if (process.env.NODE_ENV !== 'test') {
      initScheduler();
    }
  });
}

export default app;
