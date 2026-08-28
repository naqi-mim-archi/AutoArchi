import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeAutoPlanApiRequest } from '../../services/autoPlan/backend/routes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeAutoPlanApiRequest({ method: req.method, url: req.url, body: req.body }, res as any);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
