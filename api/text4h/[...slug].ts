import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeText4hApiRequest } from '../../services/text4hBackend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeText4hApiRequest({ method: req.method, url: req.url, body: req.body }, res as any);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
