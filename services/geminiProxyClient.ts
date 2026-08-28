// Client-side shim shaped like @google/genai's GoogleGenAI so callers need no changes.
// The real API key never reaches the browser — it lives only in api/gemini/generateContent.ts.
export const ai = {
  models: {
    async generateContent(request: { model: string; contents: any; config?: any }): Promise<{ text: string }> {
      const res = await fetch('/api/gemini/generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        throw new Error(`Gemini proxy error (${res.status}): ${await res.text()}`);
      }
      const data = await res.json();
      return { text: data.text as string };
    },
  },
};
