import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import kitsRoutes from './routes/kits.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

async function main() {
  await connectDB();
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(
    session({
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: env.mongodbUri }),
      cookie: {
        httpOnly: true,
        sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/kits', kitsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.port, () => console.log(`[server] listening on :${env.port}`));
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
