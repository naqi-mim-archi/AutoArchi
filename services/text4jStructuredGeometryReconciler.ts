import type { GeneratedData } from '../components/generative-wizard/types';
import type {
  Text4jStructuredGeometry,
  Text4jStructuredWallCandidate,
} from './text4jStructured3dClient';

type GeneratedWall = NonNullable<GeneratedData['walls']>[number];

export interface Text4jReconciliationRaster {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface Text4jStructuredReconciliationAudit {
  provider: 'Roboflow';
  mode: 'provider-primary' | 'local-primary' | 'repair';
  baselineWalls: number;
  structuredFaces: number;
  pairedCenterlines: number;
  straightCandidates: number;
  curvedCandidates: number;
  providerComplete: boolean;
  selectionReason: string;
  acceptedRepairs: number;
  retainedLocalApertureHosts: number;
  rejectedUnpaired: number;
  rejectedUnsupported: number;
  rejectedModeConflict: number;
  rejectedExistingWall: number;
  rejectedConnectivity: number;
  rejectedOverlap: number;
  rejectedLengthBudget: number;
  finalWalls: number;
  unavailable: boolean;
}

interface PixelPoint { x: number; y: number }
interface PixelSegment {
  p1: PixelPoint;
  p2: PixelPoint;
  length: number;
  confidence: number;
}

interface CenterlineCandidate extends PixelSegment {
  bandSupport: number;
  faceSeparation: number;
  geometryKind: 'straight' | 'curved-chord' | 'circle-bridge';
}

interface MetricSegment {
  p1: PixelPoint;
  p2: PixelPoint;
  length: number;
  bandSupport: number;
  faceSeparation: number;
  confidence: number;
  geometryKind: 'straight' | 'curved-chord' | 'circle-bridge';
}

interface SegmentRelation {
  angleDifference: number;
  normalDistance: number;
  overlapRatio: number;
  overlapStart: number;
  overlapEnd: number;
}

interface PixelMetricTransform {
  resizeRatio: number;
  metersPerPixel: number;
  sourceWallThicknessPixels: number;
  map: (point: PixelPoint) => PixelPoint;
}

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const pointDistance = (first: PixelPoint, second: PixelPoint) => Math.hypot(first.x - second.x, first.y - second.y);
const segmentLength = (p1: PixelPoint, p2: PixelPoint) => pointDistance(p1, p2);
const toPoint = (value: number[]): PixelPoint => ({ x: value[0], y: value[1] });
const toArray = (value: PixelPoint): number[] => [value.x, value.y];
const segmentAngle = (segment: Pick<PixelSegment, 'p1' | 'p2'>) =>
  Math.atan2(segment.p2.y - segment.p1.y, segment.p2.x - segment.p1.x);
const undirectedAngleDifference = (first: number, second: number) => {
  let difference = Math.abs((first - second + Math.PI) % TAU - Math.PI);
  if (difference > Math.PI / 2) difference = Math.PI - difference;
  return Math.abs(difference);
};
const axisDrift = (angle: number) => {
  const normalized = Math.abs(angle * 180 / Math.PI) % 90;
  return Math.min(normalized, 90 - normalized);
};

const projectPointToSegment = (point: PixelPoint, segment: Pick<PixelSegment, 'p1' | 'p2' | 'length'>) => {
  if (segment.length <= 1e-8) return { point: segment.p1, distance: pointDistance(point, segment.p1), progress: 0 };
  const dx = segment.p2.x - segment.p1.x, dy = segment.p2.y - segment.p1.y;
  const progress = clamp(((point.x - segment.p1.x) * dx + (point.y - segment.p1.y) * dy) / (segment.length * segment.length), 0, 1);
  const projected = { x: segment.p1.x + dx * progress, y: segment.p1.y + dy * progress };
  return { point: projected, distance: pointDistance(point, projected), progress };
};

const relateSegments = (
  first: Pick<PixelSegment, 'p1' | 'p2' | 'length'>,
  second: Pick<PixelSegment, 'p1' | 'p2' | 'length'>,
): SegmentRelation => {
  if (first.length <= 1e-8 || second.length <= 1e-8) {
    return { angleDifference: Math.PI, normalDistance: Infinity, overlapRatio: 0, overlapStart: 0, overlapEnd: 0 };
  }
  const angleDifference = undirectedAngleDifference(segmentAngle(first), segmentAngle(second));
  const unit = {
    x: (first.p2.x - first.p1.x) / first.length,
    y: (first.p2.y - first.p1.y) / first.length,
  };
  const projection = [second.p1, second.p2].map(point =>
    (point.x - first.p1.x) * unit.x + (point.y - first.p1.y) * unit.y);
  const overlapStart = Math.max(0, Math.min(...projection));
  const overlapEnd = Math.min(first.length, Math.max(...projection));
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const firstMidpoint = { x: (first.p1.x + first.p2.x) / 2, y: (first.p1.y + first.p2.y) / 2 };
  const secondMidpoint = { x: (second.p1.x + second.p2.x) / 2, y: (second.p1.y + second.p2.y) / 2 };
  const normalDistance = (
    projectPointToSegment(firstMidpoint, second).distance
    + projectPointToSegment(secondMidpoint, first).distance
  ) / 2;
  return {
    angleDifference,
    normalDistance,
    overlapRatio: overlap / Math.max(1e-8, Math.min(first.length, second.length)),
    overlapStart,
    overlapEnd,
  };
};

export const rasterIsDark = (raster: Text4jReconciliationRaster, x: number, y: number) => {
  const px = Math.round(x), py = Math.round(y);
  if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) return false;
  const offset = (py * raster.width + px) * 4;
  const red = Number(raster.data[offset] ?? 255);
  const green = Number(raster.data[offset + 1] ?? red);
  const blue = Number(raster.data[offset + 2] ?? red);
  const alpha = Number(raster.data[offset + 3] ?? 255);
  return alpha > 24 && red * 0.299 + green * 0.587 + blue * 0.114 < 185;
};

const centerlineBandSupport = (
  candidate: Pick<PixelSegment, 'p1' | 'p2' | 'length'>,
  thickness: number,
  raster: Text4jReconciliationRaster,
) => {
  if (candidate.length <= 1e-8) return 0;
  const unit = {
    x: (candidate.p2.x - candidate.p1.x) / candidate.length,
    y: (candidate.p2.y - candidate.p1.y) / candidate.length,
  };
  const normal = { x: -unit.y, y: unit.x };
  // A hollow double-line wall can have a white center. Sample far enough
  // across the detected band to include its two ink faces.
  const halfBand = Math.max(1, thickness * .48);
  const alongSamples = Math.max(10, Math.min(48, Math.round(candidate.length / 6)));
  const acrossSamples = Math.max(5, Math.min(13, Math.round(halfBand * 2) + 1));
  let dark = 0, total = 0;
  for (let index = 0; index < alongSamples; index++) {
    const distance = candidate.length * ((index + .5) / alongSamples);
    const onLine = { x: candidate.p1.x + unit.x * distance, y: candidate.p1.y + unit.y * distance };
    for (let across = 0; across < acrossSamples; across++) {
      const offset = (across / (acrossSamples - 1) - .5) * 2 * halfBand;
      total++;
      if (rasterIsDark(raster, onLine.x + normal.x * offset, onLine.y + normal.y * offset)) dark++;
    }
  }
  return total ? dark / total : 0;
};

const normalizeProviderCenterlines = (
  walls: Text4jStructuredWallCandidate[],
  raster: Text4jReconciliationRaster,
  typicalThickness: number,
  minimumRasterSupport = .32,
) => {
  let unsupported = 0;
  const verified: CenterlineCandidate[] = walls.flatMap(wall => {
    const p1 = { ...wall.p1 }, p2 = { ...wall.p2 };
    const length = segmentLength(p1, p2);
    const geometryKind = wall.geometryKind || 'straight';
    const curved = geometryKind !== 'straight';
    if (length < Math.max(curved ? 2 : 5, typicalThickness * (curved ? .32 : .9))) { unsupported++; return []; }
    const thickness = wall.thicknessPixels && wall.thicknessPixels > 0 ? wall.thicknessPixels : typicalThickness;
    const support = centerlineBandSupport({ p1, p2, length }, thickness, raster);
    // Centerlines are supported either by a solid band or the two faces of a
    // hollow wall; the latter has lower aggregate dark coverage by design.
    if (support < minimumRasterSupport) { unsupported++; return []; }
    return [{ p1, p2, length, confidence: clamp(wall.confidence * .65 + support * .35, 0, .98), bandSupport: support, faceSeparation: thickness, geometryKind }];
  });

  const candidates: CenterlineCandidate[] = [];
  let duplicates = 0;
  verified.sort((a, b) => b.bandSupport - a.bandSupport || b.length - a.length).forEach(candidate => {
    const duplicate = candidates.some(existing => {
      const relation = relateSegments(candidate, existing);
      return relation.angleDifference <= 3 * Math.PI / 180 && relation.overlapRatio >= .65 && relation.normalDistance <= Math.max(2, typicalThickness * .7);
    });
    if (duplicate) duplicates++;
    else candidates.push(candidate);
  });
  return { candidates, unsupported, duplicates };
};

const estimatePixelMetricTransform = (
  baseline: GeneratedData,
  structured: Text4jStructuredGeometry,
): PixelMetricTransform | undefined => {
  const resizeRatio = Math.min(1, 1200 / Math.max(structured.sourceWidth, structured.sourceHeight));
  const scales: number[] = [];
  const processedThicknesses: number[] = [];
  const xOffsets: number[] = [];
  const yOffsets: number[] = [];

  for (const wall of baseline.walls || []) {
    if (wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse') continue;
    const evidence = wall.evidence?.pixelBounds;
    if (!evidence) continue;
    const p1 = toPoint(wall.p1), p2 = toPoint(wall.p2);
    const metricLength = pointDistance(p1, p2);
    const horizontal = Math.abs(p2.y - p1.y) <= Math.max(0.02, metricLength * 0.025);
    const vertical = Math.abs(p2.x - p1.x) <= Math.max(0.02, metricLength * 0.025);
    if (horizontal) {
      const pixelLength = Math.max(1, evidence.x1 - evidence.x0);
      scales.push(metricLength / pixelLength);
      processedThicknesses.push(Math.max(1, evidence.y1 - evidence.y0));
    } else if (vertical) {
      const pixelLength = Math.max(1, evidence.y1 - evidence.y0);
      scales.push(metricLength / pixelLength);
      processedThicknesses.push(Math.max(1, evidence.x1 - evidence.x0));
    }
  }
  let metersPerPixel = median(scales.filter(value => Number.isFinite(value) && value > 0));
  if (!(metersPerPixel > 0)) {
    const points = (baseline.walls || []).flatMap(wall => [toPoint(wall.p1), toPoint(wall.p2)]);
    if (!points.length) return undefined;
    const spanX = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
    const spanY = Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y));
    metersPerPixel = Math.max(spanX / structured.sourceWidth, spanY / structured.sourceHeight);
  }

  for (const wall of baseline.walls || []) {
    if (wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse') continue;
    const evidence = wall.evidence?.pixelBounds;
    if (!evidence) continue;
    const p1 = toPoint(wall.p1), p2 = toPoint(wall.p2);
    const metricLength = pointDistance(p1, p2);
    const horizontal = Math.abs(p2.y - p1.y) <= Math.max(0.02, metricLength * 0.025);
    const vertical = Math.abs(p2.x - p1.x) <= Math.max(0.02, metricLength * 0.025);
    if (horizontal) {
      const metricMin = Math.min(p1.x, p2.x), metricMax = Math.max(p1.x, p2.x);
      xOffsets.push(metricMin - evidence.x0 * metersPerPixel, metricMax - evidence.x1 * metersPerPixel);
      yOffsets.push((p1.y + p2.y) / 2 + ((evidence.y0 + evidence.y1) / 2) * metersPerPixel);
    } else if (vertical) {
      xOffsets.push((p1.x + p2.x) / 2 - ((evidence.x0 + evidence.x1) / 2) * metersPerPixel);
      const metricMin = Math.min(p1.y, p2.y), metricMax = Math.max(p1.y, p2.y);
      yOffsets.push(metricMax + evidence.y0 * metersPerPixel, metricMin + evidence.y1 * metersPerPixel);
    }
  }

  const baselinePoints = (baseline.walls || []).flatMap(wall => [toPoint(wall.p1), toPoint(wall.p2)]);
  const baselineCenterX = baselinePoints.length
    ? (Math.min(...baselinePoints.map(point => point.x)) + Math.max(...baselinePoints.map(point => point.x))) / 2
    : 0;
  const baselineCenterY = baselinePoints.length
    ? (Math.min(...baselinePoints.map(point => point.y)) + Math.max(...baselinePoints.map(point => point.y))) / 2
    : 0;
  const xOffset = median(xOffsets) || baselineCenterX - structured.sourceWidth * resizeRatio * metersPerPixel / 2;
  const yOffset = median(yOffsets) || baselineCenterY + structured.sourceHeight * resizeRatio * metersPerPixel / 2;
  return {
    resizeRatio,
    metersPerPixel,
    sourceWallThicknessPixels: Math.max(3, (median(processedThicknesses) || Math.min(structured.sourceWidth, structured.sourceHeight) * 0.012) / resizeRatio),
    map: point => ({
      x: point.x * resizeRatio * metersPerPixel + xOffset,
      y: -point.y * resizeRatio * metersPerPixel + yOffset,
    }),
  };
};

const sampleWallSegments = (wall: GeneratedWall): PixelSegment[] => {
  const directedAngle = (start: number, end: number, counterclockwise = false, progress = 1) => {
    let span = counterclockwise ? start - end : end - start;
    while (span < 0) span += TAU;
    while (span >= TAU) span -= TAU;
    return counterclockwise ? start - span * progress : start + span * progress;
  };
  const wallPoint = (progress: number): PixelPoint => {
    if (wall.wallSource === 'ellipse' && wall.ellipseCenter
      && wall.ellipseRadiusX !== undefined && wall.ellipseRadiusY !== undefined) {
      const angle = directedAngle(wall.ellipseStartAngle || 0, wall.ellipseEndAngle ?? TAU, wall.ellipseCounterclockwise, progress);
      const rotation = wall.ellipseRotation || 0;
      const x = Math.cos(angle) * wall.ellipseRadiusX, y = Math.sin(angle) * wall.ellipseRadiusY;
      return {
        x: wall.ellipseCenter[0] + x * Math.cos(rotation) - y * Math.sin(rotation),
        y: wall.ellipseCenter[1] + x * Math.sin(rotation) + y * Math.cos(rotation),
      };
    }
    if ((wall.wallSource === 'arc' || wall.isCurved) && wall.arcCenter
      && wall.arcRadius !== undefined && wall.arcStartAngle !== undefined && wall.arcEndAngle !== undefined) {
      const angle = directedAngle(wall.arcStartAngle, wall.arcEndAngle, wall.arcCounterclockwise, progress);
      return { x: wall.arcCenter[0] + Math.cos(angle) * wall.arcRadius, y: wall.arcCenter[1] + Math.sin(angle) * wall.arcRadius };
    }
    if (wall.isCurved && wall.controlPoint) {
      const mt = 1 - progress;
      return {
        x: mt * mt * wall.p1[0] + 2 * mt * progress * wall.controlPoint[0] + progress * progress * wall.p2[0],
        y: mt * mt * wall.p1[1] + 2 * mt * progress * wall.controlPoint[1] + progress * progress * wall.p2[1],
      };
    }
    return {
      x: wall.p1[0] + (wall.p2[0] - wall.p1[0]) * progress,
      y: wall.p1[1] + (wall.p2[1] - wall.p1[1]) * progress,
    };
  };
  const curved = wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse';
  const count = curved ? 64 : 1;
  const segments: PixelSegment[] = [];
  let previous = wallPoint(0);
  for (let index = 1; index <= count; index++) {
    const current = wallPoint(index / count);
    const length = pointDistance(previous, current);
    if (length > 1e-6) segments.push({ p1: previous, p2: current, length, confidence: wall.evidence?.confidence || 0.8 });
    previous = current;
  }
  return segments;
};

const baselineMode = (walls: GeneratedWall[]): 'orthogonal' | 'angular' | 'curved' | 'hybrid' => {
  const curved = walls.some(wall => wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse');
  const angular = walls.some(wall => {
    if (wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse') return false;
    return axisDrift(Math.atan2(wall.p2[1] - wall.p1[1], wall.p2[0] - wall.p1[0])) > 4;
  });
  return curved ? angular ? 'hybrid' : 'curved' : angular ? 'angular' : 'orthogonal';
};

const candidateMatchesWall = (candidate: MetricSegment, wall: GeneratedWall, normalTolerance: number) =>
  sampleWallSegments(wall).some(segment => {
    const relation = relateSegments(candidate, segment);
    return relation.angleDifference <= 4 * Math.PI / 180
      && relation.overlapRatio >= 0.45
      && relation.normalDistance <= normalTolerance;
  });

const nearestPointOnWalls = (point: PixelPoint, walls: GeneratedWall[]) => {
  let best: { point: PixelPoint; distance: number; wall?: GeneratedWall } = { point, distance: Infinity };
  walls.forEach(wall => sampleWallSegments(wall).forEach(segment => {
    const projected = projectPointToSegment(point, segment);
    if (projected.distance < best.distance) best = { point: projected.point, distance: projected.distance, wall };
  }));
  return best;
};

const properSegmentIntersections = (candidate: MetricSegment, walls: GeneratedWall[], endpointTolerance: number) => {
  const intersections: PixelPoint[] = [];
  const first = candidate.p1, second = candidate.p2;
  const r = { x: second.x - first.x, y: second.y - first.y };
  walls.forEach(wall => sampleWallSegments(wall).forEach(segment => {
    const s = { x: segment.p2.x - segment.p1.x, y: segment.p2.y - segment.p1.y };
    const cross = r.x * s.y - r.y * s.x;
    if (Math.abs(cross) <= 1e-8) return;
    const offset = { x: segment.p1.x - first.x, y: segment.p1.y - first.y };
    const t = (offset.x * s.y - offset.y * s.x) / cross;
    const u = (offset.x * r.y - offset.y * r.x) / cross;
    if (t < 0 || t > 1 || u < 0 || u > 1) return;
    const point = { x: first.x + r.x * t, y: first.y + r.y * t };
    if (pointDistance(point, first) > endpointTolerance && pointDistance(point, second) > endpointTolerance) intersections.push(point);
  }));
  return intersections;
};

const countNearOverlaps = (walls: GeneratedWall[], tolerance: number) => {
  const straight = walls.flatMap((wall, index) => wall.isCurved || wall.wallSource === 'arc' || wall.wallSource === 'ellipse'
    ? []
    : [{ index, p1: toPoint(wall.p1), p2: toPoint(wall.p2), length: segmentLength(toPoint(wall.p1), toPoint(wall.p2)), confidence: 1 }]);
  let count = 0;
  straight.forEach((first, firstIndex) => {
    for (let secondIndex = firstIndex + 1; secondIndex < straight.length; secondIndex++) {
      const relation = relateSegments(first, straight[secondIndex]);
      if (relation.angleDifference <= 2 * Math.PI / 180
        && relation.overlapRatio >= 0.65
        && relation.normalDistance <= tolerance) count++;
    }
  });
  return count;
};

/**
 * A provider result may have enough total length and footprint to look
 * complete numerically while actually being several unrelated islands. That
 * is not safe to import as the wall authority when Local has one coherent
 * network. Keep this topology check deliberately comparative: detached
 * buildings remain valid when the Local source is similarly detached.
 */
const networkCoherence = (
  segments: Array<Pick<PixelSegment, 'p1' | 'p2' | 'length'>>,
  connectionTolerance: number,
  minimumLength: number,
) => {
  const retained = segments.filter(segment => segment.length >= minimumLength);
  if (!retained.length) return { components: 0, largestCoverage: 0 };
  const parents = retained.map((_, index) => index);
  const root = (index: number): number => parents[index] === index ? index : (parents[index] = root(parents[index]));
  const join = (first: number, second: number) => {
    const a = root(first), b = root(second);
    if (a !== b) parents[b] = a;
  };
  for (let first = 0; first < retained.length; first++) {
    for (let second = first + 1; second < retained.length; second++) {
      const a = retained[first], b = retained[second];
      const separation = Math.min(
        projectPointToSegment(a.p1, b).distance,
        projectPointToSegment(a.p2, b).distance,
        projectPointToSegment(b.p1, a).distance,
        projectPointToSegment(b.p2, a).distance,
      );
      if (separation <= connectionTolerance) join(first, second);
    }
  }
  const totals = new Map<number, number>();
  retained.forEach((segment, index) => {
    const key = root(index);
    totals.set(key, (totals.get(key) || 0) + segment.length);
  });
  const totalLength = retained.reduce((sum, segment) => sum + segment.length, 0);
  const largestLength = Math.max(...totals.values());
  return {
    components: totals.size,
    largestCoverage: totalLength > 1e-8 ? largestLength / totalLength : 0,
  };
};

/**
 * Door and window gaps intentionally disconnect an otherwise coherent wall
 * graph. Reconnect those components for the ownership decision only when a
 * Local aperture independently supports a collinear endpoint pair. No wall is
 * added or changed in the returned Hybrid geometry.
 */
const apertureAwareNetworkCoherence = (
  segments: Array<Pick<PixelSegment, 'p1' | 'p2' | 'length'>>,
  connectionTolerance: number,
  minimumLength: number,
  apertures: Array<{ pos: PixelPoint; width: number; rotation: number }>,
) => {
  const retained = segments.filter(segment => segment.length >= minimumLength);
  if (!retained.length) return { components: 0, largestCoverage: 0, apertureBridges: 0 };
  const parents = retained.map((_, index) => index);
  const root = (index: number): number => parents[index] === index ? index : (parents[index] = root(parents[index]));
  const join = (first: number, second: number) => {
    const a = root(first), b = root(second);
    if (a === b) return false;
    parents[b] = a;
    return true;
  };
  let apertureBridges = 0;
  for (let firstIndex = 0; firstIndex < retained.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < retained.length; secondIndex++) {
      const first = retained[firstIndex], second = retained[secondIndex];
      const separation = Math.min(
        projectPointToSegment(first.p1, second).distance,
        projectPointToSegment(first.p2, second).distance,
        projectPointToSegment(second.p1, first).distance,
        projectPointToSegment(second.p2, first).distance,
      );
      if (separation <= connectionTolerance) {
        join(firstIndex, secondIndex);
        continue;
      }
      if (undirectedAngleDifference(segmentAngle(first), segmentAngle(second)) > 10 * Math.PI / 180) continue;
      const endpointPairs = [
        [first.p1, second.p1], [first.p1, second.p2],
        [first.p2, second.p1], [first.p2, second.p2],
      ] as const;
      const [firstEndpoint, secondEndpoint] = [...endpointPairs]
        .sort((a, b) => pointDistance(a[0], a[1]) - pointDistance(b[0], b[1]))[0];
      const gapWidth = pointDistance(firstEndpoint, secondEndpoint);
      const gapAngle = Math.atan2(secondEndpoint.y - firstEndpoint.y, secondEndpoint.x - firstEndpoint.x);
      if (undirectedAngleDifference(segmentAngle(first), gapAngle) > 14 * Math.PI / 180
        || undirectedAngleDifference(segmentAngle(second), gapAngle) > 14 * Math.PI / 180) continue;
      const midpoint = {
        x: (firstEndpoint.x + secondEndpoint.x) / 2,
        y: (firstEndpoint.y + secondEndpoint.y) / 2,
      };
      const supported = apertures.some(aperture => {
        if (!(aperture.width > .2)
          || gapWidth < aperture.width * .3
          || gapWidth > aperture.width * 2.5) return false;
        const apertureAngle = aperture.rotation * Math.PI / 180;
        return undirectedAngleDifference(apertureAngle, gapAngle) <= 24 * Math.PI / 180
          && pointDistance(aperture.pos, midpoint) <= Math.max(.55, aperture.width * 1.15);
      });
      if (supported && join(firstIndex, secondIndex)) apertureBridges++;
    }
  }
  const totals = new Map<number, number>();
  retained.forEach((segment, index) => {
    const key = root(index);
    totals.set(key, (totals.get(key) || 0) + segment.length);
  });
  const totalLength = retained.reduce((sum, segment) => sum + segment.length, 0);
  return {
    components: totals.size,
    largestCoverage: totalLength > 1e-8 ? Math.max(...totals.values()) / totalLength : 0,
    apertureBridges,
  };
};

const polygonAreaAndPerimeter = (points: PixelPoint[]) => {
  let doubleArea = 0, perimeter = 0;
  for (let index = 0; index < points.length; index++) {
    const first = points[index], second = points[(index + 1) % points.length];
    doubleArea += first.x * second.y - second.x * first.y;
    perimeter += pointDistance(first, second);
  }
  return { area: Math.abs(doubleArea) / 2, perimeter };
};

const circularProviderEnvelope = (
  structured: Text4jStructuredGeometry,
  transform: PixelMetricTransform,
): number[][] | undefined => {
  const curvedPoints = structured.walls.flatMap(wall =>
    (wall.geometryKind === 'curved-chord' || wall.geometryKind === 'circle-bridge')
      ? [transform.map(wall.p1), transform.map(wall.p2)]
      : []);
  if (curvedPoints.length < 12) return undefined;
  const minX = Math.min(...curvedPoints.map(point => point.x));
  const maxX = Math.max(...curvedPoints.map(point => point.x));
  const minY = Math.min(...curvedPoints.map(point => point.y));
  const maxY = Math.max(...curvedPoints.map(point => point.y));
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const radii = curvedPoints.map(point => pointDistance(point, center));
  const radius = median(radii);
  if (!(radius > .5)) return undefined;
  const radialError = median(radii.map(value => Math.abs(value - radius))) / radius;
  const aspect = (maxX - minX) / Math.max(1e-8, maxY - minY);
  if (radialError > .08 || aspect < .82 || aspect > 1.22) return undefined;
  return Array.from({ length: 129 }, (_, index) => {
    const angle = TAU * index / 128;
    return [center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius];
  });
};

const alignCircularHybridEnvelope = (
  baseline: GeneratedData,
  structured: Text4jStructuredGeometry,
  transform: PixelMetricTransform,
): Partial<GeneratedData> | undefined => {
  const boundary = circularProviderEnvelope(structured, transform);
  if (!boundary) return undefined;
  const slabs = baseline.slabs ? baseline.slabs.map(slab => ({ ...slab, boundary: slab.type === 'floor' ? boundary.map(point => [...point]) : slab.boundary })) : undefined;
  return { boundary, ...(slabs ? { slabs } : {}) };
};

/**
 * Local apertures are classified from the source raster, but their metric
 * positions are initially expressed in the Local wall frame. When Roboflow
 * becomes wall-primary that frame can differ enough for a correct door or
 * window to float beside its corresponding provider gap. Pixel bounds are the
 * common, model-independent evidence: map their centres through the same
 * affine transform used for the Roboflow walls while leaving the Local/native
 * objects untouched.
 */
const alignHybridAperturesToProviderFrame = (
  baseline: GeneratedData,
  transform: PixelMetricTransform,
): Partial<GeneratedData> => {
  const note = 'Hybrid pose aligned from Local raster evidence into the Roboflow wall frame.';
  const align = <T extends {
    pos: number[];
    evidence?: { pixelBounds?: { x0: number; y0: number; x1: number; y1: number }; notes?: string[] };
  }>(items: T[] | undefined): T[] | undefined => items?.map(item => {
    const bounds = item.evidence?.pixelBounds;
    if (!bounds || ![bounds.x0, bounds.y0, bounds.x1, bounds.y1].every(Number.isFinite)
      || !(bounds.x1 > bounds.x0) || !(bounds.y1 > bounds.y0)) return item;
    // Local evidence is measured on the <=1200 px working raster. The
    // provider transform accepts original-source pixels, so undo the shared
    // resize before applying it.
    const sourceCenter = {
      x: ((bounds.x0 + bounds.x1) / 2) / transform.resizeRatio,
      y: ((bounds.y0 + bounds.y1) / 2) / transform.resizeRatio,
    };
    const mapped = transform.map(sourceCenter);
    return {
      ...item,
      pos: [mapped.x, mapped.y],
      evidence: item.evidence ? {
        ...item.evidence,
        notes: Array.from(new Set([...(item.evidence.notes || []), note])),
      } : item.evidence,
    };
  });

  const doors = align(baseline.doors);
  const windows = align(baseline.windows);
  const openings = align(baseline.openings);
  return {
    ...(doors ? { doors } : {}),
    ...(windows ? { windows } : {}),
    ...(openings ? { openings } : {}),
  };
};

/**
 * A very dense non-circular instance mask can represent a joined wall network.
 * If its exported centerlines cover only a small fraction of that mask's
 * implied medial length, importing it would visibly drop walls. The right
 * fallback is the untouched Local wall JSON, never invented connections.
 */
export const evaluateProviderMaskRecovery = (structured: Text4jStructuredGeometry): {
  evaluated: boolean;
  underRecovered: boolean;
  stronglyRecovered: boolean;
  minimumCoverage: number;
} => {
  const elements = (structured.candidateJson as { elements?: Array<{
    type?: string;
    digitizationConfidence?: number;
    metadata?: { roboflow?: { geometryRole?: string; planeId?: number; polygon?: PixelPoint[] }; structured3d?: { geometryRole?: string; planeId?: number; polygon?: PixelPoint[] } };
  }> })?.elements || [];
  const polygons: Array<{ points: PixelPoint[]; confidence: number; planeId: number }> = elements.flatMap(element => {
    const source = element.metadata?.roboflow || element.metadata?.structured3d;
    if (element.type !== 'wall' || source?.geometryRole !== 'outline' || !Array.isArray(source.polygon) || source.polygon.length < 3) return [];
    const points = source.polygon.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    return points.length >= 3 ? [{ points, confidence: clamp(Number(element.digitizationConfidence) || .8, 0, 1), class: 'wall', planeId: Number(source.planeId) }] : [];
  });
  // Circular plans have a separate, intentionally chord-based conversion and
  // must never be judged by straight-network length coverage. A curved chord
  // is emitted only by that dedicated Roboflow route.
  if (!polygons.length || structured.walls.some(wall => (wall.geometryKind || 'straight') !== 'straight')) {
    return { evaluated: false, underRecovered: false, stronglyRecovered: false, minimumCoverage: 0 };
  }
  const coverages = polygons.flatMap(polygon => {
    if (polygon.confidence < .9 || polygon.points.length < 500 || !Number.isFinite(polygon.planeId)) return [];
    const { area, perimeter } = polygonAreaAndPerimeter(polygon.points);
    const impliedHalfThickness = perimeter > 1e-8 ? area / perimeter : 0;
    const expectedCenterlineLength = impliedHalfThickness > 1e-8 ? area / (impliedHalfThickness * 2) : 0;
    if (expectedCenterlineLength < 100) return [];
    const recoveredLength = structured.walls
      .filter(wall => wall.planeId === polygon.planeId)
      .reduce((sum, wall) => sum + pointDistance(wall.p1, wall.p2), 0);
    return [recoveredLength / expectedCenterlineLength];
  });
  if (!coverages.length) return { evaluated: false, underRecovered: false, stronglyRecovered: false, minimumCoverage: 0 };
  const minimumCoverage = Math.min(...coverages);
  return {
    evaluated: true,
    underRecovered: minimumCoverage < .58,
    // Dense masks can legitimately contain several components because doors
    // and windows split their centreline graph. When the connector preserved
    // at least 82% of every evaluated mask, that separation is aperture
    // topology—not evidence that Local should replace the Roboflow walls.
    stronglyRecovered: minimumCoverage >= .82,
    minimumCoverage,
  };
};

export const reconcileText4jStructuredGeometryWithRaster = (
  baseline: GeneratedData,
  structured: Text4jStructuredGeometry,
  raster: Text4jReconciliationRaster,
): { data: GeneratedData; audit: Text4jStructuredReconciliationAudit } => {
  const baselineWalls = [...(baseline.walls || [])];
  const audit: Text4jStructuredReconciliationAudit = {
    provider: 'Roboflow',
    mode: 'repair',
    baselineWalls: baselineWalls.length,
    structuredFaces: structured.walls.length,
    pairedCenterlines: 0,
    straightCandidates: structured.walls.filter(wall => (wall.geometryKind || 'straight') === 'straight').length,
    curvedCandidates: structured.walls.filter(wall => (wall.geometryKind || 'straight') !== 'straight').length,
    providerComplete: false,
    selectionReason: 'Roboflow geometry has not been evaluated yet.',
    acceptedRepairs: 0,
    retainedLocalApertureHosts: 0,
    rejectedUnpaired: 0,
    rejectedUnsupported: 0,
    rejectedModeConflict: 0,
    rejectedExistingWall: 0,
    rejectedConnectivity: 0,
    rejectedOverlap: 0,
    rejectedLengthBudget: 0,
    finalWalls: baselineWalls.length,
    unavailable: false,
  };
  const finalize = (walls: GeneratedWall[], unavailableWarning?: string, overrides?: Partial<GeneratedData>) => ({
    data: {
      ...baseline,
      ...overrides,
      walls,
      extractionDiagnostics: baseline.extractionDiagnostics ? {
        ...baseline.extractionDiagnostics,
        warnings: audit.unavailable && unavailableWarning
          ? [unavailableWarning, ...baseline.extractionDiagnostics.warnings]
          : baseline.extractionDiagnostics.warnings,
        metrics: baseline.extractionDiagnostics.metrics ? {
          ...baseline.extractionDiagnostics.metrics,
          wallCount: walls.length,
        } : baseline.extractionDiagnostics.metrics,
        structuredReconciliation: { ...audit },
      } : baseline.extractionDiagnostics,
    },
    audit,
  });
  const transform = estimatePixelMetricTransform(baseline, structured);
  if (!transform || baselineWalls.length < 3) {
    audit.unavailable = true;
    audit.mode = 'local-primary';
    audit.selectionReason = 'Local Primary: Roboflow could not be aligned to the Local metric frame.';
    return finalize(
      baselineWalls,
      `Roboflow contribution unavailable: Local baseline ${baselineWalls.length} walls = J Hybrid Final ${baselineWalls.length} walls because pixel-to-Local alignment could not be established.`,
    );
  }

  const providerThickness = median(structured.walls.map(wall => Number(wall.thicknessPixels)).filter(value => Number.isFinite(value) && value > 0));
  const sourceThickness = providerThickness || transform.sourceWallThicknessPixels;
  // Start with the permissive detector support needed for pale/double-line
  // drawings, then make the ownership decision from measured completeness.
  // Raw segment count is deliberately not an ownership signal: a broken circle
  // can contain many tiny chords while still missing most of its footprint.
  const normalized = normalizeProviderCenterlines(
    structured.walls,
    raster,
    sourceThickness,
    baseline.extractionDiagnostics?.confidence === 'low'
      || structured.walls.some(wall => (wall.geometryKind || 'straight') !== 'straight')
      ? .04
      : .32,
  );
  audit.pairedCenterlines = normalized.candidates.length;
  audit.rejectedUnpaired = normalized.duplicates;
  audit.rejectedUnsupported = normalized.unsupported;
  const candidates: MetricSegment[] = normalized.candidates.map(candidate => {
    const p1 = transform.map(candidate.p1), p2 = transform.map(candidate.p2);
    return { ...candidate, p1, p2, length: pointDistance(p1, p2) };
  });
  const mode = baselineMode(baselineWalls);
  const baselineLength = baselineWalls.reduce((sum, wall) =>
    sum + sampleWallSegments(wall).reduce((wallSum, segment) => wallSum + segment.length, 0), 0);
  const candidateLength = candidates.reduce((sum, candidate) => sum + candidate.length, 0);
  const curvedCandidateLength = candidates
    .filter(candidate => candidate.geometryKind !== 'straight')
    .reduce((sum, candidate) => sum + candidate.length, 0);
  const wallThicknessMeters = Math.max(0.08, sourceThickness * transform.resizeRatio * transform.metersPerPixel);
  const networkConnectionTolerance = Math.max(0.22, wallThicknessMeters * 2.2);
  const networkMinimumLength = Math.max(0.16, wallThicknessMeters * .75);
  const providerNetwork = networkCoherence(candidates, networkConnectionTolerance, networkMinimumLength);
  const localNetwork = networkCoherence(
    baselineWalls.flatMap(sampleWallSegments), networkConnectionTolerance, networkMinimumLength,
  );
  const apertureHints = [
    ...(baseline.doors || []),
    ...(baseline.windows || []),
    ...(baseline.openings || []),
  ].flatMap(aperture => aperture.pos?.length >= 2 && Number(aperture.width) > .2
    ? [{
        pos: toPoint(aperture.pos),
        width: Number(aperture.measuredWidth) > .2 ? Number(aperture.measuredWidth) : Number(aperture.width),
        rotation: Number(aperture.rotation) || 0,
      }]
    : []);
  const apertureAwareProviderNetwork = apertureAwareNetworkCoherence(
    candidates,
    networkConnectionTolerance,
    networkMinimumLength,
    apertureHints,
  );
  const providerApertureSeparated = apertureAwareProviderNetwork.apertureBridges > 0
    && apertureAwareProviderNetwork.largestCoverage >= .68
    && apertureAwareProviderNetwork.largestCoverage >= providerNetwork.largestCoverage + .24;
  // Do not replace an intact Local plan with a disconnected Roboflow fragment
  // cloud. This catches failed connected-instance conversion while leaving
  // genuine detached plan parts alone when Local has the same topology.
  const providerMaskRecovery = evaluateProviderMaskRecovery(structured);
  const providerUnderRecovered = providerMaskRecovery.underRecovered;
  // A validated circular shell is intentionally split at doors/windows, so
  // its largest connected chord island is not a completeness signal. The
  // circular envelope check independently requires a stable centre, radius,
  // aspect and radial fit; once that passes, keep Roboflow authoritative and
  // let Local contribute only rooms/openings/details.
  const verifiedCircularProvider = !!circularProviderEnvelope(structured, transform);
  const providerFragmented = candidates.length >= 8
    && providerNetwork.components >= 3
    && providerNetwork.largestCoverage < .58
    && localNetwork.largestCoverage >= providerNetwork.largestCoverage + .18
    && !providerMaskRecovery.stronglyRecovered
    && !verifiedCircularProvider;
  const providerTrulyFragmented = providerFragmented && !providerApertureSeparated;
  const boundsOf = (points: PixelPoint[]) => points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y), maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const baselineBounds = boundsOf(baselineWalls.flatMap(wall => sampleWallSegments(wall).flatMap(segment => [segment.p1, segment.p2])));
  const candidateBounds = boundsOf(candidates.flatMap(candidate => [candidate.p1, candidate.p2]));
  const baselineSpanX = baselineBounds.maxX - baselineBounds.minX, baselineSpanY = baselineBounds.maxY - baselineBounds.minY;
  const candidateSpanX = candidateBounds.maxX - candidateBounds.minX, candidateSpanY = candidateBounds.maxY - candidateBounds.minY;
  const extentCoverage = Math.min(
    baselineSpanX > 1e-6 ? candidateSpanX / baselineSpanX : 1,
    baselineSpanY > 1e-6 ? candidateSpanY / baselineSpanY : 1,
  );
  const lengthCoverage = baselineLength > 1e-6 ? candidateLength / baselineLength : 0;
  const curvedCoverage = baselineLength > 1e-6 ? curvedCandidateLength / baselineLength : 0;
  const requiresCurvedCoverage = mode === 'curved' || mode === 'hybrid';
  // The raster band-support pass above re-verifies every candidate against the
  // uploaded photo pixel-for-pixel. That check is intentionally strict, but a
  // small registration mismatch between the reconciliation raster and the mask
  // coordinates (resize, compression, EXIF) hits long/diagonal walls hardest
  // and can silently starve extent/length coverage while every other polygon
  // still passes. evaluateProviderMaskRecovery already proved (independent of
  // the raster) that the connector's own polygon-to-centerline conversion
  // faithfully recovered the mask, so a strong result there is sufficient on
  // its own to satisfy the coverage gate below, exactly as it already does for
  // the fragmentation check.
  // A raster-band mismatch that hits most/all candidates (a real photo's
  // compression, lighting or registration noise, not just one polygon) can
  // starve `candidates` itself, not only the coverage ratios above. The same
  // independent, raster-free proof that bypasses the coverage gate must also
  // bypass the raster-derived candidate-count floor below it -- otherwise a
  // photo that fails band-support broadly still blocks a mask conversion this
  // function has already verified is correct.
  const providerVerifiedIndependently = verifiedCircularProvider || providerMaskRecovery.stronglyRecovered;
  const coverageSatisfied = providerVerifiedIndependently || (
    extentCoverage >= .82
    && lengthCoverage >= .55
    && (!requiresCurvedCoverage || curvedCoverage >= .22)
  );
  audit.providerComplete = (candidates.length >= 3 || providerVerifiedIndependently)
    && coverageSatisfied
    && !providerUnderRecovered;
  audit.selectionReason = providerUnderRecovered
    ? 'Local Primary: a dense non-circular Roboflow wall mask lost too much centerline length during conversion.'
    : audit.providerComplete
    ? providerApertureSeparated
      ? `Roboflow Primary eligible: ${apertureAwareProviderNetwork.apertureBridges} disconnected wall gaps were independently matched to Local door/window evidence (${Math.round(apertureAwareProviderNetwork.largestCoverage * 100)}% aperture-aware network coverage).`
      : providerTrulyFragmented
      ? `Roboflow Primary eligible: verified footprint, wall-length and raster support override disconnected-island topology (${Math.round(providerNetwork.largestCoverage * 100)}% largest island); door/window gaps and detached runs are retained exactly.`
      : verifiedCircularProvider
      ? `Roboflow Primary eligible: a stable circular provider envelope was verified independently of aperture-separated chord connectivity.`
      : providerMaskRecovery.stronglyRecovered && !(extentCoverage >= .82 && lengthCoverage >= .55 && (!requiresCurvedCoverage || curvedCoverage >= .22))
      ? `Roboflow Primary eligible: mask recovery preserved ${Math.round(providerMaskRecovery.minimumCoverage * 100)}% of the detected wall mask (raster band-support coverage was only ${Math.round(extentCoverage * 100)}% footprint span, ${Math.round(lengthCoverage * 100)}% wall-length).`
      : `Roboflow Primary eligible: ${Math.round(extentCoverage * 100)}% footprint span, ${Math.round(lengthCoverage * 100)}% wall-length coverage${requiresCurvedCoverage ? `, ${Math.round(curvedCoverage * 100)}% curved coverage` : ''}.`
    : `${baseline.extractionDiagnostics?.confidence === 'low' ? 'Local Primary' : 'Local Repair'}: Roboflow conversion incomplete (${Math.round(extentCoverage * 100)}% footprint span, ${Math.round(lengthCoverage * 100)}% wall-length coverage${requiresCurvedCoverage ? `, ${Math.round(curvedCoverage * 100)}% curved coverage` : ''}${providerTrulyFragmented ? `, ${Math.round(providerNetwork.largestCoverage * 100)}% largest connected island` : ''}).`;
  const providerPrimary = audit.providerComplete;
  if (providerUnderRecovered || (baseline.extractionDiagnostics?.confidence === 'low' && !audit.providerComplete)) {
    audit.mode = 'local-primary';
    audit.finalWalls = baselineWalls.length;
    return finalize(baselineWalls);
  }
  // When Local declares its extraction low-confidence, or the detector
  // recovered substantially more verified structure, Roboflow leads walls.
  // Local still owns all native scale, rooms, openings and labels.
  audit.mode = providerPrimary ? 'provider-primary' : 'repair';
  const existingTolerance = Math.max(0.12, wallThicknessMeters * 1.3);
  const connectionTolerance = Math.max(0.22, wallThicknessMeters * 1.8);
  const overlapTolerance = Math.max(0.08, wallThicknessMeters * 1.35);
  const overlapBaseline = providerPrimary ? [] : baselineWalls;
  const baselineOverlapCount = countNearOverlaps(overlapBaseline, overlapTolerance);
  const maximumAddedLength = Math.max(2.5, baselineLength * 0.38);
  const bounds = [...baselineWalls.flatMap(wall => [toPoint(wall.p1), toPoint(wall.p2)]), ...(providerPrimary ? candidates.flatMap(candidate => [candidate.p1, candidate.p2]) : [])].reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y), maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const accepted: GeneratedWall[] = [];
  const acceptedGeometryKinds: MetricSegment['geometryKind'][] = [];
  let acceptedLength = 0;
  let currentOverlapCount = baselineOverlapCount;

  candidates.sort((a, b) => b.bandSupport - a.bandSupport || b.length - a.length).forEach(candidate => {
    const angle = segmentAngle(candidate);
    const drift = axisDrift(angle);
    if (!providerPrimary && ((mode === 'orthogonal' && drift > 3)
      || ((mode === 'curved' || mode === 'hybrid') && drift > 4))) {
      audit.rejectedModeConflict++;
      return;
    }
    const minimumCandidateLength = providerPrimary
      ? candidate.geometryKind === 'straight'
        ? Math.max(.12, wallThicknessMeters * .45)
        : Math.max(.05, wallThicknessMeters * .18)
      : Math.max(.22, wallThicknessMeters * .8);
    if (candidate.length < minimumCandidateLength
      || (!providerPrimary && candidate.bandSupport < .4)) {
      audit.rejectedUnsupported++;
      return;
    }
    if ((!providerPrimary && baselineWalls.some(wall => candidateMatchesWall(candidate, wall, existingTolerance)))
      || (!providerPrimary && accepted.some(wall => candidateMatchesWall(candidate, wall, existingTolerance)))) {
      audit.rejectedExistingWall++;
      return;
    }
    const firstAttachment = nearestPointOnWalls(candidate.p1, [...baselineWalls, ...accepted]);
    const secondAttachment = nearestPointOnWalls(candidate.p2, [...baselineWalls, ...accepted]);
    if (!providerPrimary && (firstAttachment.distance > connectionTolerance || secondAttachment.distance > connectionTolerance)) {
      audit.rejectedConnectivity++;
      return;
    }
    if (!providerPrimary && properSegmentIntersections(candidate, baselineWalls, connectionTolerance).length > 1) {
      audit.rejectedConnectivity++;
      return;
    }
    const snapped = providerPrimary ? { ...candidate } : {
      ...candidate,
      p1: firstAttachment.point,
      p2: secondAttachment.point,
      length: pointDistance(firstAttachment.point, secondAttachment.point),
    };
    if (snapped.length < (providerPrimary ? minimumCandidateLength : Math.max(.18, wallThicknessMeters * .65))
      || (!providerPrimary && baselineWalls.some(wall => candidateMatchesWall(snapped, wall, existingTolerance)))
      || (!providerPrimary && accepted.some(wall => candidateMatchesWall(snapped, wall, existingTolerance)))) {
      audit.rejectedExistingWall++;
      return;
    }
    const midpoint = { x: (snapped.p1.x + snapped.p2.x) / 2, y: (snapped.p1.y + snapped.p2.y) / 2 };
    const exterior = snapped.geometryKind !== 'straight' || Math.min(
      Math.abs(midpoint.x - bounds.minX), Math.abs(midpoint.x - bounds.maxX),
      Math.abs(midpoint.y - bounds.minY), Math.abs(midpoint.y - bounds.maxY),
    ) <= connectionTolerance && (providerPrimary || (firstAttachment.wall?.type === 'exterior' && secondAttachment.wall?.type === 'exterior'));
    const repair: GeneratedWall = {
      levelIndex: 0,
      p1: toArray(snapped.p1),
      p2: toArray(snapped.p2),
      type: exterior ? 'exterior' : 'interior',
      measuredThickness: wallThicknessMeters,
      wallSource: 'line',
      isCurved: false,
      provenance: 'repair-generated',
      evidence: {
        source: 'geometry-repair',
        confidence: clamp(snapped.confidence, 0, 0.94),
        notes: [providerPrimary
          ? `Roboflow wall centerline selected as the authoritative wall (${Math.round(snapped.bandSupport * 100)}% raster-band support).`
          : `Roboflow wall centerline accepted as a missing Local wall (${Math.round(snapped.bandSupport * 100)}% raster-band support).`],
      },
    };
    if (!providerPrimary && acceptedLength + snapped.length > maximumAddedLength) {
      audit.rejectedLengthBudget++;
      return;
    }
    if (!providerPrimary) {
      const proposedWalls = [...overlapBaseline, ...accepted, repair];
      const proposedOverlapCount = countNearOverlaps(proposedWalls, overlapTolerance);
      if (proposedOverlapCount > currentOverlapCount) {
        audit.rejectedOverlap++;
        return;
      }
      currentOverlapCount = proposedOverlapCount;
    }
    accepted.push(repair);
    acceptedGeometryKinds.push(snapped.geometryKind);
    acceptedLength += snapped.length;
  });

  // The normalized candidates above are evidence for deciding whether the
  // provider is complete. Once that gate passes, they must not become a second
  // lossy conversion stage. Rebuild the accepted set directly from every wall
  // emitted by the Roboflow connector, applying only the shared pixel-to-metric
  // affine transform. This keeps count, ordering, endpoints and straight/curve
  // classification invariant between the Roboflow and Hybrid panes.
  if (providerPrimary) {
    accepted.length = 0;
    acceptedGeometryKinds.length = 0;
    acceptedLength = 0;
    structured.walls.forEach(sourceWall => {
      const geometryKind = sourceWall.geometryKind || 'straight';
      const p1 = transform.map(sourceWall.p1), p2 = transform.map(sourceWall.p2);
      const length = pointDistance(p1, p2);
      if (!(length > 1e-6)) return;
      const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const exterior = geometryKind !== 'straight' || Math.min(
        Math.abs(midpoint.x - bounds.minX), Math.abs(midpoint.x - bounds.maxX),
        Math.abs(midpoint.y - bounds.minY), Math.abs(midpoint.y - bounds.maxY),
      ) <= connectionTolerance;
      const measuredThickness = Math.max(
        0.08,
        (Number(sourceWall.thicknessPixels) > 0 ? Number(sourceWall.thicknessPixels) : sourceThickness)
          * transform.resizeRatio * transform.metersPerPixel,
      );
      accepted.push({
        levelIndex: 0,
        p1: toArray(p1),
        p2: toArray(p2),
        type: exterior ? 'exterior' : 'interior',
        measuredThickness,
        wallSource: 'line',
        isCurved: false,
        provenance: 'repair-generated',
        evidence: {
          source: 'geometry-repair',
          confidence: clamp(sourceWall.confidence, 0, 0.98),
          notes: [`Roboflow ${geometryKind} wall preserved verbatim through the Hybrid affine transform.`],
        },
      });
      acceptedGeometryKinds.push(geometryKind);
      acceptedLength += length;
    });
  }

  // Provider-primary has a strict ownership boundary: Roboflow owns every
  // visible wall and Local owns only non-wall architectural data. Do not add
  // Local aperture-host walls here. They changed both the wall count and the
  // visible mask topology, so a clean Roboflow result became blocky in Hybrid.
  // Local doors/windows are hosted later by the importer without mutating this
  // authoritative wall array.
  const acceptedProviderLength = accepted.reduce((sum, wall) => sum + pointDistance(toPoint(wall.p1), toPoint(wall.p2)), 0);
  const acceptedCurvedLength = accepted
    .filter((_, index) => acceptedGeometryKinds[index] !== 'straight')
    .reduce((sum, wall) => sum + pointDistance(toPoint(wall.p1), toPoint(wall.p2)), 0);
  const exactProviderLength = providerPrimary
    ? structured.walls.reduce((sum, wall) => sum + pointDistance(transform.map(wall.p1), transform.map(wall.p2)), 0)
    : candidateLength;
  const exactCurvedLength = providerPrimary
    ? structured.walls.filter(wall => (wall.geometryKind || 'straight') !== 'straight')
      .reduce((sum, wall) => sum + pointDistance(transform.map(wall.p1), transform.map(wall.p2)), 0)
    : curvedCandidateLength;
  const providerRetention = exactProviderLength > 1e-6 ? acceptedProviderLength / exactProviderLength : 0;
  const curvedRetention = exactCurvedLength > 1e-6 ? acceptedCurvedLength / exactCurvedLength : 1;
  const providerSurvivedFinalValidation = accepted.length >= 3
    && providerRetention >= .72
    && (!requiresCurvedCoverage || curvedRetention >= .62);
  let walls = providerPrimary && providerSurvivedFinalValidation ? [...accepted] : [...baselineWalls, ...accepted];
  if (providerPrimary && !providerSurvivedFinalValidation) {
    audit.unavailable = true;
    audit.mode = 'local-primary';
    audit.providerComplete = false;
    audit.selectionReason = `Local Primary: only ${Math.round(providerRetention * 100)}% of converted Roboflow wall length and ${Math.round(curvedRetention * 100)}% of its curved wall length survived final validation.`;
    walls = baselineWalls;
  } else if (providerPrimary) {
    audit.selectionReason += ` Preserved ${Math.round(providerRetention * 100)}% of converted wall length and ${Math.round(curvedRetention * 100)}% of curved wall length in Hybrid.`;
  }
  audit.acceptedRepairs = accepted.length;
  audit.retainedLocalApertureHosts = 0;
  audit.finalWalls = walls.length;
  const hybridEnvelope = providerPrimary && providerSurvivedFinalValidation
    ? alignCircularHybridEnvelope(baseline, structured, transform)
    : undefined;
  const hybridApertures = providerPrimary && providerSurvivedFinalValidation
    ? alignHybridAperturesToProviderFrame(baseline, transform)
    : undefined;
  return finalize(walls, undefined, { ...hybridEnvelope, ...hybridApertures });
};

export const loadReconciliationRaster = (
  imageBase64: string,
  width: number,
  height: number,
): Promise<Text4jReconciliationRaster> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('The browser could not create the Roboflow reconciliation raster.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(context.getImageData(0, 0, width, height));
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error('The source image could not be decoded for Roboflow reconciliation.'));
  image.src = imageBase64;
});

export const reconcileText4jStructuredGeometry = async (
  imageBase64: string,
  baseline: GeneratedData,
  structured: Text4jStructuredGeometry,
) => reconcileText4jStructuredGeometryWithRaster(
  baseline,
  structured,
  await loadReconciliationRaster(imageBase64, structured.sourceWidth, structured.sourceHeight),
);
