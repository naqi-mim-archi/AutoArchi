import { convertRoboflowWallsToCenterlines, type RoboflowWallPolygon } from './roboflowWallConnector';
import { loadReconciliationRaster, rasterIsDark } from './text4jStructuredGeometryReconciler';

export interface Text4jStructuredPixelPoint {
  x: number;
  y: number;
}

export interface Text4jStructuredWallCandidate {
  id: string;
  p1: Text4jStructuredPixelPoint;
  p2: Text4jStructuredPixelPoint;
  confidence: number;
  planeId?: number;
  lineId?: number;
  thicknessPixels?: number;
  geometryKind?: 'straight' | 'curved-chord' | 'circle-bridge';
}

export interface Text4jStructuredGeometry {
  sourceWidth: number;
  sourceHeight: number;
  processingMs: number;
  jobId: string;
  walls: Text4jStructuredWallCandidate[];
  candidateJson: unknown;
}

interface StructuredApiResponse {
  success?: boolean;
  error?: string;
  jobId?: string;
  processingMs?: number;
  sourceImage?: { width?: number; height?: number };
  archaiCandidateData?: {
    elements?: Array<{
      id?: string;
      type?: string;
      digitizationConfidence?: number;
      metadata?: {
        roboflow?: {
          planeId?: number;
          lineId?: number;
          thicknessPixels?: number;
          geometryKind?: 'straight' | 'curved-chord' | 'circle-bridge';
          polygon?: Text4jStructuredPixelPoint[];
          sourcePixelP1?: Text4jStructuredPixelPoint;
          sourcePixelP2?: Text4jStructuredPixelPoint;
        };
        /** Legacy response compatibility for sessions started before the Roboflow route rename. */
        structured3d?: {
          planeId?: number;
          lineId?: number;
          thicknessPixels?: number;
          geometryKind?: 'straight' | 'curved-chord' | 'circle-bridge';
          polygon?: Text4jStructuredPixelPoint[];
          sourcePixelP1?: Text4jStructuredPixelPoint;
          sourcePixelP2?: Text4jStructuredPixelPoint;
        };
      };
    }>;
  };
}

const finitePoint = (value: unknown): value is Text4jStructuredPixelPoint => {
  const point = value as Text4jStructuredPixelPoint | undefined;
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
};

const wallNetworkLength = (walls: Text4jStructuredWallCandidate[]): number => walls.reduce((sum, wall) =>
  sum + Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y), 0);

const shouldPreferClientRefinement = (
  baselineWalls: Text4jStructuredWallCandidate[],
  refinedWalls: Text4jStructuredWallCandidate[],
): boolean => {
  if (refinedWalls.length < 3) return false;
  const baselineLength = wallNetworkLength(baselineWalls);
  const refinedLength = wallNetworkLength(refinedWalls);
  if (!(baselineLength > 0)) return true;

  // Prefer optional ink refinement when it recovers materially more of
  // Roboflow's recognized mask, or when equivalent length is represented with
  // at least as much topology. Never replace a fuller polygon conversion with
  // a shorter result merely because it has more fragmented segments.
  if (refinedLength > baselineLength * 1.03) return true;
  return refinedLength >= baselineLength * .98 && refinedWalls.length >= baselineWalls.length;
};

export const requestText4jStructuredGeometry = async (
  imageBase64: string,
): Promise<Text4jStructuredGeometry> => {
  const response = await fetch('/api/text4j/roboflow/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  const payload = await response.json() as StructuredApiResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Roboflow wall detection failed with HTTP ${response.status}.`);
  }

  const sourceWidth = Number(payload.sourceImage?.width);
  const sourceHeight = Number(payload.sourceImage?.height);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    throw new Error('Roboflow did not return the source image dimensions required for J geometry alignment.');
  }

  const walls = (payload.archaiCandidateData?.elements || []).flatMap((element, index) => {
    if (element.type !== 'wall') return [];
    const source = element.metadata?.roboflow || element.metadata?.structured3d;
    if (!finitePoint(source?.sourcePixelP1) || !finitePoint(source?.sourcePixelP2)) return [];
    const length = Math.hypot(
      source.sourcePixelP2.x - source.sourcePixelP1.x,
      source.sourcePixelP2.y - source.sourcePixelP1.y,
    );
    if (length < 2) return [];
    return [{
      id: element.id || `structured-wall-${index + 1}`,
      p1: source.sourcePixelP1,
      p2: source.sourcePixelP2,
      confidence: Number.isFinite(element.digitizationConfidence)
        ? Math.max(0, Math.min(1, Number(element.digitizationConfidence)))
        : 0.8,
      planeId: source.planeId,
      lineId: source.lineId,
      thicknessPixels: Number.isFinite(source.thicknessPixels) ? Number(source.thicknessPixels) : undefined,
      geometryKind: source.geometryKind,
    }];
  });

  const polygons: RoboflowWallPolygon[] = (payload.archaiCandidateData?.elements || []).flatMap(element => {
    const outline = (element.metadata?.roboflow || element.metadata?.structured3d)?.polygon;
    if (element.type !== 'wall' || !Array.isArray(outline) || outline.length < 3) return [];
    return [{ points: outline.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y)), confidence: Number.isFinite(element.digitizationConfidence) ? Math.max(0, Math.min(1, Number(element.digitizationConfidence))) : .8, class: 'wall' }];
  });
  let resolvedWalls: Text4jStructuredWallCandidate[] = walls;
  const maxWallThicknessPixels = Math.max(8, Math.min(sourceWidth, sourceHeight) * .045);
  if (polygons.length) {
    // Re-run the polygon conversion in the hot-reloaded browser module before
    // attempting any optional canvas work. Previously both operations shared
    // one try block, so a canvas/raster failure silently restored stale server
    // centerlines and dropped walls which Roboflow had correctly recognized.
    // Polygon conversion itself is deterministic and does not require raster
    // access; when valid, it is the authoritative current connector result.
    const current = convertRoboflowWallsToCenterlines(polygons, { maxWallThicknessPixels });
    const currentWalls = current.map(wall => ({ id: wall.id, p1: wall.p1, p2: wall.p2, confidence: wall.confidence, planeId: wall.polygonIndex, thicknessPixels: wall.thicknessPixels, geometryKind: wall.geometryKind }));
    if (currentWalls.length >= 3) resolvedWalls = currentWalls;

    try {
      const raster = await loadReconciliationRaster(imageBase64, sourceWidth, sourceHeight);
      const refined = convertRoboflowWallsToCenterlines(polygons, {
        isWallPixel: (x, y) => rasterIsDark(raster, x, y),
        maxWallThicknessPixels,
      });
      const refinedWalls = refined.map(wall => ({ id: wall.id, p1: wall.p1, p2: wall.p2, confidence: wall.confidence, planeId: wall.polygonIndex, thicknessPixels: wall.thicknessPixels, geometryKind: wall.geometryKind }));
      if (shouldPreferClientRefinement(resolvedWalls, refinedWalls)) resolvedWalls = refinedWalls;
    } catch (error) {
      console.warn('[Text 4.0 J] Roboflow ink refinement unavailable; using current polygon centerlines.', error);
    }
  }
  if (resolvedWalls.length < 3) {
    throw new Error(`Roboflow returned only ${resolvedWalls.length} usable wall candidates; J requires a primary geometry network.`);
  }

  return {
    sourceWidth,
    sourceHeight,
    processingMs: Number(payload.processingMs) || 0,
    jobId: payload.jobId || '',
    walls: resolvedWalls,
    candidateJson: payload.archaiCandidateData,
  };
};
