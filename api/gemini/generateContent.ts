import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    const { model, contents, config } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({ model, contents, config });
    res.status(200).json({ text: result.text });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
}
