import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { seedDatabase, connectToMongoDB } from './server/db.js';
import { hashPassword } from './server/auth.js';
import { migrateLegacyMechanicUsers, seedMongoMechanics, seedMongoUsers } from './server/services/userService.js';
import { initSocketServer } from './server/socket/socketServer.js';
import apiRouter from './server/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load local environment variables from both supported local env locations.
dotenv.config({ path: path.resolve(projectRoot, 'env/.env.local') });
dotenv.config({ path: path.resolve(__dirname, 'env/.env.local') });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '0.0.0.0';

  // Wrap express app with an HTTP server to enable Socket.io upgrades
  const server = createServer(app);

  // Initialize our unified Socket.io server
  initSocketServer(server);

  // User authentication is MongoDB-only. Startup fails fast if Atlas is unavailable.
  await connectToMongoDB();
  await migrateLegacyMechanicUsers();

  await seedMongoUsers([
    {
      name: 'System Admin',
      email: 'admin@autoaid.ai',
      role: 'admin',
      passwordHash: hashPassword('admin123'),
    },
    {
      name: 'Sarah Jenkins',
      email: 'demo@autoaid.ai',
      role: 'user',
      passwordHash: hashPassword('demo123'),
    },
    {
      name: 'Sarah Jenkins',
      email: 'demo@autoaid.ai',
      role: 'user',
      passwordHash: hashPassword('demo123'),
    },
  ]);

  await seedMongoMechanics([
    {
      name: 'Mission Auto Care & Tuning',
      email: 'mechanic@autoaid.ai',
      passwordHash: hashPassword('demo123'),
    },
  ]);

  // Run non-user database seeds to populate lists
  try {
    seedDatabase();
  } catch (err) {
    console.error('Failed to seed database:', err);
  }

  // Register JSON body parser with a larger payload limit for base64 image uploads
  app.use(express.json({ limit: '50mb' }));

  // Mount entire REST API pipeline first
  app.use('/api', apiRouter);

  // Mount Vite middleware in development or static asset serving in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running server in Development mode with Vite middleware...');
    const vite = await createViteServer({
      root: path.resolve(projectRoot, 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running server in Production mode...');
    const distPath = path.resolve(projectRoot, 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`AutoAid AI server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
