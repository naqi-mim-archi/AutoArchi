import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeAiRenderApiRequest } from '../../services/aiRender/backend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = await routeAiRenderApiRequest({ method: req.method, url: req.url, body: req.body }, res as any);
  if (!handled) res.status(404).json({ error: 'Not found' });
}
