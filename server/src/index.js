import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import cors from 'cors';
import searchRoutes from './routes/search.js';
import opportunityRoutes from './routes/opportunities.js';
import crawlerRoutes from './routes/crawler.js';
import favoriteRoutes from './routes/favorites.js';
import catalogueRoutes from './routes/catalogue.js';
import saasRoutes from './routes/saas.js';
import { getDb } from './db/index.js';
import { ensureSeedImported } from './services/saasImporter.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', searchRoutes);
app.use('/api', opportunityRoutes);
app.use('/api', crawlerRoutes);
app.use('/api', favoriteRoutes);
app.use('/api', catalogueRoutes);
app.use('/api', saasRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await getDb();
  console.log('Database initialized');

  try {
    await ensureSeedImported();
  } catch (err) {
    console.warn('SaaS seed import skipped:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
