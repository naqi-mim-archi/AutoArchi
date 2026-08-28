import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeText4fApiRequest } from '../../services/text4fBackend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeText4fApiRequest({ method: req.method, url: req.url, body: req.body }, res as any);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
