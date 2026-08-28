import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeRevitExportApiRequest } from '../../../services/revitExport/backend/revitExportApiRoutes';
import { ApsRevitExportBackend } from '../../../services/revitExport/backend/apsRevitExportBackend';
import { createKvRevitExportJobStore } from '../../../services/revitExport/backend/kvRevitExportJobStore';

const backend = new ApsRevitExportBackend(undefined, createKvRevitExportJobStore());

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeRevitExportApiRequest({ method: req.method, url: req.url, body: req.body }, res as any, backend);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
