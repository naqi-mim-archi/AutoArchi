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

  // Pasting the key into a shell or a dashboard field often carries the surrounding quotes
  // into the stored value. GoogleAuth then reads the file and JSON.parse fails with
  // `Unexpected token ''', "'{"type":""... is not valid JSON`, which surfaces as an opaque
  // 500 on every Vertex-backed route. A service-account key is always a JSON object, so a
  // leading/trailing quote can only be packaging.
  const trimmed = raw.trim();
  const unquoted = trimmed.length > 1
    && (trimmed.startsWith("'") || trimmed.startsWith('"'))
    && trimmed.endsWith(trimmed[0])
    && !trimmed.startsWith('{')
    ? trimmed.slice(1, -1)
    : trimmed;

  const keyPath = path.join(os.tmpdir(), `${envVarName}.json`);
  fs.writeFileSync(keyPath, unquoted, { mode: 0o600 });
  materializedPaths.set(envVarName, keyPath);
  return keyPath;
}
