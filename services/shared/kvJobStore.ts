// Generic {create, update, get} job store backed by Vercel KV, falling back to an
// in-memory Map when KV isn't configured (e.g. local `vite dev`). Used anywhere a job
// needs to survive across separate serverless invocations (submit now, poll status later).
let kvClient: any = null;
let kvAttempted = false;

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

const JOB_TTL_SECONDS = 60 * 60 * 24; // Revit export/import jobs can run longer than AI-render jobs

export function createKvJobStore<TRecord extends { jobId: string; updatedAt: string }>(namespace: string) {
  const memoryStore = new Map<string, TRecord>();
  const key = (jobId: string) => `${namespace}:job:${jobId}`;

  return {
    async create(record: TRecord): Promise<void> {
      const kv = await getKv();
      if (kv) {
        await kv.set(key(record.jobId), record, { ex: JOB_TTL_SECONDS });
        return;
      }
      memoryStore.set(record.jobId, record);
    },
    async update(jobId: string, patch: Partial<TRecord>): Promise<TRecord> {
      const kv = await getKv();
      if (kv) {
        const existing = (await kv.get(key(jobId))) as TRecord | null;
        if (!existing) throw new Error(`Unknown job: ${jobId}`);
        const next = { ...existing, ...patch, updatedAt: new Date().toISOString() } as TRecord;
        await kv.set(key(jobId), next, { ex: JOB_TTL_SECONDS });
        return next;
      }
      const existing = memoryStore.get(jobId);
      if (!existing) throw new Error(`Unknown job: ${jobId}`);
      const next = { ...existing, ...patch, updatedAt: new Date().toISOString() } as TRecord;
      memoryStore.set(jobId, next);
      return next;
    },
    async get(jobId: string): Promise<TRecord | null> {
      const kv = await getKv();
      if (kv) return ((await kv.get(key(jobId))) as TRecord | null) ?? null;
      return memoryStore.get(jobId) ?? null;
    },
  };
}
