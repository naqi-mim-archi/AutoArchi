import type { GeneratedData } from '../../components/generative-wizard/types';
import { extractGeometryFromLocalImage } from '../localImageToJSON4j';
import { warmLocalFloorplanOcr4j } from '../localFloorplanOcr4j';
import { requestText4jStructuredGeometry } from '../text4jStructured3dClient';
import { reconcileText4jStructuredGeometry } from '../text4jStructuredGeometryReconciler';
import {
  buildAutoPlanDesignSummary,
  generatedDataToAutoPlanPayload,
} from './autoPlanText4jGeometry';
import {
  AutoPlanBoundary,
  AutoPlanBrief,
  AutoPlanInferenceRequest,
  AutoPlanInferenceResponse,
} from './autoPlanTypes';

// Auto Plan runs the same Text 4.0 J engine as the wizard: one generated raster, then
// Roboflow wall detection and the unchanged local native JSON extractor side by side, then
// Roboflow's centerlines reconciled over the local baseline. Both halves have to run in the
// browser — the local extractor and the reconciliation raster need a canvas — so only the
// image generation stays on the server. Nothing here touches Auto Plan's UI labels.

// Matches the exterior thickness the Auto Plan image prompt asks for (9in) and the default
// the payload conversion applies to exterior walls.
const AUTO_PLAN_EXTERIOR_WALL_THICKNESS_M = 0.23;

export const canRunAutoPlanBrowserPipeline = (): boolean =>
  typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && typeof Image !== 'undefined';

interface AutoPlanImageResponse {
  imageBase64: string;
  brief: AutoPlanBrief;
  prompt?: string;
  generationMs?: number;
}

const requestAutoPlanImage = async (request: AutoPlanInferenceRequest): Promise<AutoPlanImageResponse> => {
  const response = await fetch('/api/auto-plan/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Auto Plan image generation failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!payload?.imageBase64 || !payload?.brief) {
    throw new Error('Auto Plan image generation returned no image.');
  }
  return payload as AutoPlanImageResponse;
};

export const runAutoPlanText4jBrowserPipeline = async (
  request: AutoPlanInferenceRequest,
): Promise<AutoPlanInferenceResponse> => {
  const workflowStartedAt = Date.now();
  const boundary: AutoPlanBoundary = request.boundary;
  const logs: AutoPlanInferenceResponse['logs'] = [];
  const warnings: string[] = [];

  // Best-effort warm-up of the cached OCR worker while Vertex renders the image, exactly as
  // Text 4.0 J does. It never delays or blocks the image request.
  void warmLocalFloorplanOcr4j();

  logs.push({ level: 'info', message: 'Generating floorplan image via Text 4.0 J (Vertex AI).' });
  const image = await requestAutoPlanImage(request);
  const brief = image.brief;

  console.log('[Auto Plan] Step 2: Running Roboflow and the unchanged J-local baseline in parallel');
  logs.push({
    level: 'info',
    message: 'Running Roboflow wall detection and the local native JSON extractor side by side.',
  });

  const structuredStartedAt = Date.now();
  const extractionStartedAt = Date.now();
  const structuredTask = requestText4jStructuredGeometry(image.imageBase64).then(structuredGeometry => {
    console.log(`[Auto Plan] Roboflow returned ${structuredGeometry.walls.length} wall-centerline candidates in ${Date.now() - structuredStartedAt}ms (service ${structuredGeometry.processingMs}ms)`);
    return structuredGeometry;
  });
  const localTask = extractGeometryFromLocalImage(image.imageBase64, {
    requestedBoundary: boundary.points,
    requestedWidthMeters: boundary.width,
    requestedDepthMeters: boundary.height,
    designSummary: buildAutoPlanDesignSummary(brief),
    enforceRequestedEnvelope: true,
    exteriorWallThicknessMeters: AUTO_PLAN_EXTERIOR_WALL_THICKNESS_M,
    // Wait for OCR rather than dropping room labels at the preview cutoff — Auto Plan turns
    // those labels into its room nodes.
    awaitOcrCompletion: true,
  });

  const [structuredResult, localResult] = await Promise.allSettled([structuredTask, localTask]);

  if (localResult.status === 'rejected') {
    const reason = localResult.reason instanceof Error ? localResult.reason.message : String(localResult.reason);
    throw new Error(`Auto Plan local native JSON extraction failed: ${reason}`);
  }

  let rawGeometry: GeneratedData;
  let reconciliationSummary: Record<string, unknown>;

  if (structuredResult.status === 'fulfilled') {
    console.log('[Auto Plan] Step 3: Reconciling Roboflow wall centerlines over the unchanged Local baseline');
    const reconciled = await reconcileText4jStructuredGeometry(
      image.imageBase64,
      localResult.value,
      structuredResult.value,
    );
    rawGeometry = reconciled.data;
    reconciliationSummary = {
      provider: 'Roboflow',
      pairedCenterlines: reconciled.audit.pairedCenterlines,
      acceptedRepairs: reconciled.audit.acceptedRepairs,
      finalWalls: reconciled.audit.finalWalls,
    };
    console.log(`[Auto Plan] Geometry reconciliation kept ${reconciled.audit.acceptedRepairs} repairs from ${reconciled.audit.pairedCenterlines} candidates.`);
    logs.push({
      level: 'info',
      message: `Reconciled Roboflow centerlines over the local baseline: ${reconciled.audit.acceptedRepairs} repairs from ${reconciled.audit.pairedCenterlines} candidates.`,
    });
  } else {
    // Roboflow failed but the Local baseline succeeded — degrade to Local-only geometry
    // instead of failing the run, the same way Text 4.0 J does.
    const failure = structuredResult.reason instanceof Error
      ? structuredResult.reason.message
      : String(structuredResult.reason);
    rawGeometry = localResult.value;
    reconciliationSummary = { provider: 'Roboflow', unavailable: true, selectionReason: failure };
    warnings.push(`Roboflow wall contribution unavailable; retained complete Local geometry: ${failure}`);
    logs.push({
      level: 'warning',
      message: `Roboflow wall detection unavailable; continuing with the local native JSON geometry. ${failure}`,
    });
  }

  console.log(`[Auto Plan] Local extraction completed in ${Date.now() - extractionStartedAt}ms; total workflow ${Date.now() - workflowStartedAt}ms`);

  rawGeometry.sourceImageBase64 = image.imageBase64;
  for (const warning of rawGeometry.extractionDiagnostics?.warnings || []) {
    warnings.push(warning);
  }

  const payload = generatedDataToAutoPlanPayload(rawGeometry, boundary, brief, {
    inferenceStage: 'text4j-roboflow-local-reconciled',
    diagnostics: {
      structuredReconciliation: reconciliationSummary,
      localExtraction: {
        confidence: rawGeometry.extractionDiagnostics?.confidence,
        detectedRoomLabels: rawGeometry.extractionDiagnostics?.detectedRoomLabels,
        walls: rawGeometry.walls?.length || 0,
      },
      workflowMs: Date.now() - workflowStartedAt,
    },
  });

  return { payload, warnings, logs };
};
