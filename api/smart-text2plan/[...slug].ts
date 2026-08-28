import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeSmartText2PlanApiRequest } from '../../services/smartText2planBackend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeSmartText2PlanApiRequest({ method: req.method, url: req.url, body: req.body }, res as any);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
