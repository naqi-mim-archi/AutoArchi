import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { routeText2PlanApiRequest } from '../services/text2planBackend';
import { routeText4dApiRequest } from '../services/text4dBackend';
import { routeText4eApiRequest } from '../services/text4eBackend';
import { routeText4fApiRequest } from '../services/text4fBackend';
import { routeText4gApiRequest } from '../services/text4gBackend';
import { routeText4hApiRequest } from '../services/text4hBackend';
import { routeText4jApiRequest } from '../services/text4jBackend';
import { routeSmartText2PlanApiRequest } from '../services/smartText2planBackend';
import { routeAiRenderApiRequest } from '../services/aiRender/backend';
import { routeAutoPlanApiRequest } from '../services/autoPlan/backend/routes';
import { routeRevitExportApiRequest } from '../services/revitExport/backend/revitExportApiRoutes';
import { ApsRevitExportBackend } from '../services/revitExport/backend/apsRevitExportBackend';
import { createKvRevitExportJobStore } from '../services/revitExport/backend/kvRevitExportJobStore';
import { routeApsRevitImportApiRequest } from '../services/apsRevitImport/backend/apsRevitImportApiRoutes';
import { ApsRevitImportBackend } from '../services/apsRevitImport/backend/apsRevitImportBackend';
import { createKvApsRevitImportJobStore } from '../services/apsRevitImport/backend/kvApsRevitImportJobStore';

// A single catch-all Vercel function serving every API route. Vercel's Hobby plan caps
// deployments at 12 serverless functions — one file per route family would have meant 13.
// This mirrors the exact dispatch logic already used by vite.config.js's dev middleware,
// just consolidated into one Lambda; none of the underlying route handlers changed.
//
// Every backend is imported statically on purpose. `await import('../services/…')` left the
// specifier unresolved in the deployed bundle, so the Lambda died at runtime with
// "Cannot find module '/var/task/services/text2planBackend'" — Node's ESM resolver does not
// retry extensionless paths. Static imports get bundled at build time instead.
type ApiRequestShape = { method?: string; url?: string; body?: any };

// vercel.json rewrites every /api/* request here as `/api?__path=/api/<original path>`,
// because a function in the api/ directory only serves its own path — nothing else matched
// /api/gemini/generateContent and Vercel answered with its own NOT_FOUND page. The rewrite
// makes req.url point at this file, so the original path travels in __path; rebuild the URL
// the route handlers expect (path + the caller's own query string) from it.
const resolveRequestUrl = (req: VercelRequest): string => {
  const [rawPath, rawQuery = ''] = (req.url || '').split('?');
  // Read __path (and the caller's own params) from both places Vercel may expose them:
  // the rewritten req.url's query string and the parsed req.query object.
  const search = new URLSearchParams(rawQuery);
  const query = (req.query || {}) as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || search.has(key)) continue;
    if (Array.isArray(value)) value.forEach(entry => search.append(key, entry));
    else search.append(key, value);
  }

  const forwarded = search.get('__path');
  search.delete('__path');
  const path = forwarded || rawPath;
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
};

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
    // Explicit vertexai: false — without it, the SDK falls back to
    // process.env.GOOGLE_GENAI_USE_VERTEXAI, which Vertex-backed flows sharing this
    // process (text4d-j, ai-render, auto-plan) set to 'true' as a side effect. Without
    // this override, this plain-API-key client silently gets hijacked into Vertex mode.
    const ai = new GoogleGenAI({ apiKey, vertexai: false });
    const result = await ai.models.generateContent({ model, contents, config });
    res.status(200).json({ text: result.text });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || String(error) });
  }
};

// Reused across warm invocations of this function, same as the dev middleware's singletons.
let revitExportBackend: ApsRevitExportBackend | undefined;
let apsRevitImportBackend: ApsRevitImportBackend | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = resolveRequestUrl(req);
  const request: ApiRequestShape = { method: req.method, url, body: req.body };

  try {
    if (url.startsWith('/api/gemini/generateContent')) {
      await dispatchGemini(req, res);
      return;
    }

    if (url.startsWith('/api/text2plan')) {
      const handled = await routeText2PlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4d')) {
      const handled = await routeText4dApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4e')) {
      const handled = await routeText4eApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4f')) {
      const handled = await routeText4fApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4g')) {
      const handled = await routeText4gApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4h')) {
      const handled = await routeText4hApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/text4j')) {
      const handled = await routeText4jApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/smart-text2plan')) {
      const handled = await routeSmartText2PlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/ai-render')) {
      const handled = await routeAiRenderApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/auto-plan')) {
      const handled = await routeAutoPlanApiRequest(request, res as any);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/exports/revit')) {
      if (!revitExportBackend) {
        revitExportBackend = new ApsRevitExportBackend(undefined, createKvRevitExportJobStore());
      }
      const handled = await routeRevitExportApiRequest(request, res as any, revitExportBackend);
      if (!handled) res.status(404).json({ error: 'Not found' });
      return;
    }
    if (url.startsWith('/api/imports/aps-revit')) {
      if (!apsRevitImportBackend) {
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
