import type { ConfirmedText4jBrief } from '../../text4jBrief';
import { generateText4jFloorplanImage, generateText4jMasterGeometry } from '../../text4jBackend';
import { buildText4jMasterFloorplanPrompt, normalizeText4jMasterFloorplanData } from '../../text4jMasterFloorplanData';
import {
  buildAutoPlanImagePrompt,
  generatedDataToAutoPlanPayload,
} from '../autoPlanText4jGeometry';
import {
  AutoPlanBoundary,
  AutoPlanBrief,
  AutoPlanInferenceRequest,
  AutoPlanInferenceResponse,
} from '../autoPlanTypes';

export { generatedDataToAutoPlanPayload };

// Serverless fallback path. The browser runs the full Text 4.0 J pipeline — Roboflow wall
// detection and the local native JSON extractor side by side, then reconciled (see
// services/autoPlan/autoPlanText4jClient.ts) — because the local extractor needs a canvas.
// This Lambda-only route keeps working for callers without a DOM by using the Gemini master
// geometry pass alone, which is what Auto Plan used before the dual pipeline was wired in.

export const generateAutoPlanFloorplanImage = async (
  boundary: AutoPlanBoundary,
  brief: AutoPlanBrief,
): Promise<{ imageBytes: string; prompt: string; generationMs: number }> => {
  const prompt = buildAutoPlanImagePrompt(boundary, brief);
  const imageResult = await generateText4jFloorplanImage(prompt);
  if (!imageResult.imageBytes) {
    throw new Error('Text 4.0 J did not return a floorplan image.');
  }
  return { imageBytes: imageResult.imageBytes, prompt, generationMs: imageResult.generationMs };
};

export const runText4jAutoPlanInference = async (
  request: AutoPlanInferenceRequest & { normalizedBrief?: AutoPlanBrief },
): Promise<AutoPlanInferenceResponse> => {
  const { boundary, normalizedBrief } = request;
  if (!normalizedBrief) {
    throw new Error('runText4jAutoPlanInference requires a normalized brief.');
  }

  const logs: AutoPlanInferenceResponse['logs'] = [];

  logs.push({ level: 'info', message: 'Generating floorplan image via Text 4.0 J (Vertex AI).' });
  const imageResult = await generateAutoPlanFloorplanImage(boundary, normalizedBrief);

  logs.push({ level: 'info', message: 'Extracting structured geometry from the generated floorplan image.' });
  const geometryPrompt = buildText4jMasterFloorplanPrompt(
    undefined as unknown as ConfirmedText4jBrief,
    'generated',
    boundary.points,
    { width: boundary.width, depth: boundary.height },
  );
  const masterGeometryResult = await generateText4jMasterGeometry({
    imageBytes: imageResult.imageBytes,
    mimeType: 'image/jpeg',
    prompt: geometryPrompt,
    thinkingLevel: 'low',
  });

  const generatedData = normalizeText4jMasterFloorplanData(masterGeometryResult.geometry, {
    brief: undefined as unknown as ConfirmedText4jBrief,
    imageBase64: imageResult.imageBytes,
    sourceKind: 'generated',
    requestedBoundary: boundary.points,
    requestedExtentsMeters: { width: boundary.width, depth: boundary.height },
  });

  const payload = generatedDataToAutoPlanPayload(generatedData, boundary, normalizedBrief);

  return { payload, warnings: [], logs };
};
