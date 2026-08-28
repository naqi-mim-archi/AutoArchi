import { Point } from '../../../types';
import type { GeneratedData } from '../../../components/generative-wizard/types';
import type { ConfirmedText4jBrief } from '../../text4jBrief';
import { generateText4jFloorplanImage, generateText4jMasterGeometry } from '../../text4jBackend';
import { buildText4jMasterFloorplanPrompt, normalizeText4jMasterFloorplanData } from '../../text4jMasterFloorplanData';
import {
  AutoPlanBoundary,
  AutoPlanBrief,
  AutoPlanImportPayload,
  AutoPlanInferenceRequest,
  AutoPlanInferenceResponse,
  AutoPlanMetadata,
  AutoPlanOpening,
  AutoPlanRoomNode,
  AutoPlanRoomPolygon,
  AutoPlanWallSegment,
} from '../autoPlanTypes';

// Text 4.0 J has no reusable "design brief" input — its prompt is free text describing
// the desired floorplan. This turns Auto Plan's structured brief into that free text.
const buildImagePrompt = (boundary: AutoPlanBoundary, brief: AutoPlanBrief): string => {
  const BASE_PROMPT = `A professional 2D architectural floor plan rendered on a clean, solid white background. High-contrast minimalist style. All structural exterior walls are exactly 9 inches thick and filled with a solid, pure black color. All interior partition walls are exactly 4.5 inches thick and also filled with solid black. No wall shading, no textures, and no patterns. Doors are drawn as clean single-line arcs showing swing direction. Windows are represented by simple parallel lines within the black walls. Crisp, highly legible sans-serif black text labels each room with its name. No furniture layout, no flooring textures, and no color fills outside of the black walls.`;

  const roomList = brief.rooms.map(r => `${r.count}x ${r.type}${r.required ? '' : ' (optional)'}`).join(', ');
  const adjacency = brief.adjacencyRules.map(r => `${r.spaceA} ${r.relationship} ${r.spaceB}`).join('; ');
  const avoid = brief.negativeRules.map(r => `${r.spaceA} should avoid ${r.spaceB}`).join('; ');
  const dimensions = boundary.width && boundary.height
    ? `The plan must fit within a boundary of approximately ${boundary.width}x${boundary.height} ${boundary.units}.`
    : '';

  return [
    BASE_PROMPT,
    `Residential type: ${brief.residentialType}.`,
    `Rooms required: ${roomList || 'a standard residential layout'}.`,
    adjacency ? `Adjacency requirements: ${adjacency}.` : '',
    avoid ? `Avoid adjacency: ${avoid}.` : '',
    brief.mustHave.length ? `Must include: ${brief.mustHave.join(', ')}.` : '',
    brief.mustNotHave.length ? `Must not include: ${brief.mustNotHave.join(', ')}.` : '',
    brief.notes ? `Additional notes: ${brief.notes}.` : '',
    dimensions,
  ].filter(Boolean).join('\n\n');
};

const raySegmentIntersection = (origin: Point, dir: Point, a: Point, b: Point): number | null => {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const denom = dir.x * sy - dir.y * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const dx = a.x - origin.x;
  const dy = a.y - origin.y;
  const t = (dx * sy - dy * sx) / denom;
  const s = (dx * dir.y - dy * dir.x) / denom;
  if (t > 1e-6 && s >= 0 && s <= 1) return t;
  return null;
};

// Text4j only gives a label + center point per room, not a polygon. This approximates a
// room's boundary by casting rays out from its center and stopping at the nearest wall
// (or the site boundary) in each direction — a simple, always-valid star-shaped polygon,
// not a proper planar-graph face reconstruction.
const estimateRoomPolygon = (center: Point, walls: AutoPlanWallSegment[], maxDistance: number, rayCount = 16): Point[] => {
  const polygon: Point[] = [];
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    let closestT = maxDistance;
    for (const wall of walls) {
      const t = raySegmentIntersection(center, dir, wall.start, wall.end);
      if (t !== null && t < closestT) closestT = t;
    }
    polygon.push({ x: center.x + dir.x * closestT, y: center.y + dir.y * closestT });
  }
  return polygon;
};

const projectPointOntoWall = (point: Point, wall: AutoPlanWallSegment): { t: number; distance: number } => {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return { t: 0, distance: Infinity };
  const t = Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSq));
  const projX = wall.start.x + t * dx;
  const projY = wall.start.y + t * dy;
  return { t, distance: Math.hypot(point.x - projX, point.y - projY) };
};

const findNearestWall = (point: Point, walls: AutoPlanWallSegment[]): { wall: AutoPlanWallSegment; t: number } | null => {
  let best: { wall: AutoPlanWallSegment; t: number; distance: number } | null = null;
  for (const wall of walls) {
    const { t, distance } = projectPointOntoWall(point, wall);
    if (!best || distance < best.distance) best = { wall, t, distance };
  }
  return best ? { wall: best.wall, t: best.t } : null;
};

// Text4j's absolute door/window positions need to become Auto Plan's wall-relative form
// (hostWallId + position 0..1), and its point-only rooms need an approximate polygon.
export const generatedDataToAutoPlanPayload = (
  data: GeneratedData,
  boundary: AutoPlanBoundary,
  brief: AutoPlanBrief,
): AutoPlanImportPayload => {
  const walls: AutoPlanWallSegment[] = (data.walls || [])
    .filter(w => Array.isArray(w.p1) && Array.isArray(w.p2))
    .map((w, i) => ({
      id: `wall-${i}`,
      start: { x: w.p1[0], y: w.p1[1] },
      end: { x: w.p2[0], y: w.p2[1] },
      thickness: w.measuredThickness ?? (w.type === 'exterior' ? 0.23 : 0.15),
      wallType: w.type,
      source: 'model' as const,
    }));

  const openings: AutoPlanOpening[] = [];
  const addOpenings = (entries: GeneratedData['doors'] | GeneratedData['windows'], type: 'door' | 'window') => {
    (entries || []).forEach((entry, i) => {
      if (!Array.isArray(entry.pos)) return;
      const nearest = findNearestWall({ x: entry.pos[0], y: entry.pos[1] }, walls);
      if (!nearest) return;
      openings.push({
        id: `${type}-${i}`,
        type,
        hostWallId: nearest.wall.id,
        position: nearest.t,
        width: entry.width,
        source: 'model',
      });
    });
  };
  addOpenings(data.doors, 'door');
  addOpenings(data.windows, 'window');

  const boundaryWalls: AutoPlanWallSegment[] = boundary.points.map((p, i) => ({
    id: `boundary-${i}`,
    start: p,
    end: boundary.points[(i + 1) % boundary.points.length],
    thickness: 0,
    source: 'model' as const,
  }));
  const raycastWalls = [...walls, ...boundaryWalls];
  const maxDistance = Math.max(boundary.width || 0, boundary.height || 0, 20) * 1.5;

  const roomEntries = (data.rooms || []).filter(r => Array.isArray(r.pos));

  const rooms: AutoPlanRoomPolygon[] = roomEntries.map((room, i) => {
    const center = { x: room.pos[0], y: room.pos[1] };
    return {
      id: `room-${i}`,
      type: room.label,
      label: room.label,
      boundary: estimateRoomPolygon(center, raycastWalls, maxDistance),
      source: 'model' as const,
    };
  });

  const nodes: AutoPlanRoomNode[] = roomEntries.map((room, i) => ({
    id: `node-${i}`,
    type: room.label,
    label: room.label,
    x: room.pos[0],
    y: room.pos[1],
    required: true,
    source: 'model' as const,
  }));

  const metadata: AutoPlanMetadata = {
    generator: 'Auto Plan',
    feature: 'AI Residential Floorplan Generator',
    model: 'text4j_vertex',
    modelWeightsPath: '',
    sourcePrototypePath: '',
    createdAt: new Date().toISOString(),
    inferenceStage: 'text4j-vertex-adapter',
  };

  return { boundary, brief, nodes, walls, openings, rooms, metadata };
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
  const imagePrompt = buildImagePrompt(boundary, normalizedBrief);
  const imageResult = await generateText4jFloorplanImage(imagePrompt);
  if (!imageResult.imageBytes) {
    throw new Error('Text 4.0 J did not return a floorplan image.');
  }

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
