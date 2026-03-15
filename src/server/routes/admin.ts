import { Router } from 'express';
import { runAdminQuery } from '../db.js';

export const adminRouter = Router();

// Middleware: require admin
adminRouter.use((req, res, next) => {
  if (!req.user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
});

// Execute SQL query
adminRouter.post('/query', (req, res) => {
  const { sql } = req.body as { sql?: string };

  if (!sql || typeof sql !== 'string') {
    res.status(400).json({ error: 'Missing sql' });
    return;
  }

  try {
    const result = runAdminQuery(sql);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
