import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeApsRevitImportApiRequest } from '../../../services/apsRevitImport/backend/apsRevitImportApiRoutes';
import { ApsRevitImportBackend } from '../../../services/apsRevitImport/backend/apsRevitImportBackend';
import { createKvApsRevitImportJobStore } from '../../../services/apsRevitImport/backend/kvApsRevitImportJobStore';

const backend = new ApsRevitImportBackend(undefined, createKvApsRevitImportJobStore());

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeApsRevitImportApiRequest({ method: req.method, url: req.url, body: req.body }, res as any, backend);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
