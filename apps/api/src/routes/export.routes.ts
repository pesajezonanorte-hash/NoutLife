import { Router } from 'express';
import { Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as exportService from '../services/export.service';

const router = Router();
router.use(requireAuth);

router.get('/json', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await exportService.exportUserData(req.userId!);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="noutlife-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Error exportando datos.' });
  }
});

router.get('/transactions.csv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const csv = await exportService.exportTransactionsCSV(req.userId!);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transacciones-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('﻿' + csv); // BOM for Excel UTF-8
  } catch {
    res.status(500).json({ error: 'Error exportando transacciones.' });
  }
});

export default router;
