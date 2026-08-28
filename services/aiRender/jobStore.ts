import type { Job } from './backend';

// Falls back to an in-memory Map when Vercel KV isn't configured (e.g. local `vite dev`),
// and uses KV once KV_REST_API_URL/KV_REST_API_TOKEN are present (attached via the Vercel dashboard).
// This is what makes job status survive across separate serverless invocations in production.
let kvClient: any = null;
let kvAttempted = false;
const memoryStore = new Map<string, Job>();

async function getKv(): Promise<any | null> {
  if (kvAttempted) return kvClient;
  kvAttempted = true;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  try {
    const { kv } = await import('@vercel/kv');
    kvClient = kv;
  } catch {
    kvClient = null;
  }
  return kvClient;
}

const jobKey = (jobId: string) => `ai-render:job:${jobId}`;
const JOB_TTL_SECONDS = 60 * 60 * 6; // jobs are short-lived; no need to keep them forever

export async function getJob(jobId: string): Promise<Job | null> {
  const kv = await getKv();
  if (kv) return ((await kv.get(jobKey(jobId))) as Job | null) ?? null;
  return memoryStore.get(jobId) ?? null;
}

export async function setJob(jobId: string, job: Job): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(jobKey(jobId), job, { ex: JOB_TTL_SECONDS });
    return;
  }
  memoryStore.set(jobId, job);
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<Job | null> {
  const existing = await getJob(jobId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await setJob(jobId, next);
  return next;
}
