import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// A single catch-all Vercel function serving every API route. Vercel's Hobby plan caps
// deployments at 12 serverless functions — one file per route family would have meant 13.
// This mirrors the exact dispatch logic already used by vite.config.js's dev middleware,
// just consolidated into one Lambda; none of the underlying route handlers changed.
type ApiRequestShape = { method?: string; url?: string; body?: any };

const dispatchGemini = async (req: VercelRequest, res: VercelResponse) => {
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
};

// Reused across warm invocations of this function, same as the dev middleware's singletons.
let revitExportBackend: any;
let apsRevitImportBackend: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const request: ApiRequestShape = { method: req.method, url, body: req.body };

  try {
    if (url.startsWith('/api/gemini/generateContent')) {
      await dispatchGemini(req, res);
      return;
    }

    if (url.startsWith('/api/text2plan')) {
      const { routeText2PlanApiRequest } = await import('../services/text2planBackend');
      const handled = await routeText2PlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4d')) {
      const { routeText4dApiRequest } = await import('../services/text4dBackend');
      const handled = await routeText4dApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4e')) {
      const { routeText4eApiRequest } = await import('../services/text4eBackend');
      const handled = await routeText4eApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4f')) {
      const { routeText4fApiRequest } = await import('../services/text4fBackend');
      const handled = await routeText4fApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4g')) {
      const { routeText4gApiRequest } = await import('../services/text4gBackend');
      const handled = await routeText4gApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4h')) {
      const { routeText4hApiRequest } = await import('../services/text4hBackend');
      const handled = await routeText4hApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4j')) {
      const { routeText4jApiRequest } = await import('../services/text4jBackend');
      const handled = await routeText4jApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/smart-text2plan')) {
      const { routeSmartText2PlanApiRequest } = await import('../services/smartText2planBackend');
      const handled = await routeSmartText2PlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/ai-render')) {
      const { routeAiRenderApiRequest } = await import('../services/aiRender/backend');
      const handled = await routeAiRenderApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/auto-plan')) {
      const { routeAutoPlanApiRequest } = await import('../services/autoPlan/backend/routes');
      const handled = await routeAutoPlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/exports/revit')) {
      const { routeRevitExportApiRequest } = await import('../services/revitExport/backend/revitExportApiRoutes');
      if (!revitExportBackend) {
        const [{ ApsRevitExportBackend }, { createKvRevitExportJobStore }] = await Promise.all([
          import('../services/revitExport/backend/apsRevitExportBackend'),
          import('../services/revitExport/backend/kvRevitExportJobStore'),
        ]);
        revitExportBackend = new ApsRevitExportBackend(undefined, createKvRevitExportJobStore());
      }
      const handled = await routeRevitExportApiRequest(request, res as any, revitExportBackend);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/imports/aps-revit')) {
      const { routeApsRevitImportApiRequest } = await import('../services/apsRevitImport/backend/apsRevitImportApiRoutes');
      if (!apsRevitImportBackend) {
        const [{ ApsRevitImportBackend }, { createKvApsRevitImportJobStore }] = await Promise.all([
          import('../services/apsRevitImport/backend/apsRevitImportBackend'),
          import('../services/apsRevitImport/backend/kvApsRevitImportJobStore'),
        ]);
        apsRevitImportBackend = new ApsRevitImportBackend(undefined, createKvApsRevitImportJobStore());
      }
      const handled = await routeApsRevitImportApiRequest(request, res as any, apsRevitImportBackend);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error: any) {
    if (!res.writableEnded) {
      res.status(500).json({ error: error?.message || String(error) });
    }
  }
}
