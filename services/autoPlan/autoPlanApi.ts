import { autoPlanPayloadToArchElements } from './autoPlanImport';
import { canRunAutoPlanBrowserPipeline, runAutoPlanText4jBrowserPipeline } from './autoPlanText4jClient';
import { AutoPlanInferenceRequest, AutoPlanInferenceResponse } from './autoPlanTypes';

const requestServerAutoPlan = async (
  request: AutoPlanInferenceRequest,
): Promise<AutoPlanInferenceResponse> => {
  const response = await fetch('/api/auto-plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Auto Plan failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as AutoPlanInferenceResponse;
};

export const generateAutoPlan = async (
  request: AutoPlanInferenceRequest,
): Promise<AutoPlanInferenceResponse> => {
  // Preferred path: the full Text 4.0 J engine, with Roboflow wall detection and the local
  // native JSON extractor running side by side in the browser. The server-only route stays
  // as a fallback because the local extractor needs a canvas, so a DOM-less caller — or a
  // deployment that predates /api/auto-plan/image — still gets a plan.
  let result: AutoPlanInferenceResponse;
  if (canRunAutoPlanBrowserPipeline()) {
    try {
      result = await runAutoPlanText4jBrowserPipeline(request);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[Auto Plan] Text 4.0 J browser pipeline unavailable; falling back to server-side geometry. ${reason}`);
      result = await requestServerAutoPlan(request);
      result.warnings = [
        `Roboflow + local native JSON pipeline unavailable; used server-side Text 4.0 J geometry instead: ${reason}`,
        ...(result.warnings || []),
      ];
    }
  } else {
    result = await requestServerAutoPlan(request);
  }

  if (!result.projectElements) {
    const converted = autoPlanPayloadToArchElements(result.payload);
    result.projectElements = converted.elements;
    result.warnings = Array.from(new Set([...(result.warnings || []), ...converted.warnings]));
  }
  return result;
};
