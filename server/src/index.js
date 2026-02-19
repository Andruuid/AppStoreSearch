import express from 'express';
import cors from 'cors';
import searchRoutes from './routes/search.js';
import opportunityRoutes from './routes/opportunities.js';
import { getDb } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', searchRoutes);
app.use('/api', opportunityRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await getDb();
  console.log('Database initialized');

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
