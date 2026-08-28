import fs from 'fs';
import os from 'os';
import path from 'path';

// Vertex AI (via GoogleAuth / GOOGLE_APPLICATION_CREDENTIALS) only knows how to read
// service-account credentials from a file on disk. Vercel env vars are strings, so we
// materialize the JSON into a file under the writable /tmp dir once per warm instance,
// instead of requiring a credentials file to be committed to the repo.
const materializedPaths = new Map<string, string>();

export function getVertexCredentialsPath(envVarName: string): string | null {
  const existing = materializedPaths.get(envVarName);
  if (existing && fs.existsSync(existing)) return existing;

  const raw = process.env[envVarName];
  if (!raw) return null;

  const keyPath = path.join(os.tmpdir(), `${envVarName}.json`);
  fs.writeFileSync(keyPath, raw, { mode: 0o600 });
  materializedPaths.set(envVarName, keyPath);
  return keyPath;
}
