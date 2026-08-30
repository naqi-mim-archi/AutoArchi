/**
 * Converts Roboflow wall-segmentation polygons into source-image pixel-space
 * centerlines.  This module deliberately has no dependency on the wizard,
 * native GeneratedData types, or reconciliation code.
 */
export interface RoboflowPoint { x: number; y: number }

export interface RoboflowWallPolygon {
  points: RoboflowPoint[];
  confidence: number;
  class: string;
  detectionId?: string;
}

export interface RoboflowWallCenterline {
  id: string;
  p1: RoboflowPoint;
  p2: RoboflowPoint;
  confidence: number;
  thicknessPixels: number;
  polygonIndex: number;
  /** Keeps curved wall chords out of the strict straight-junction filter. */
  geometryKind: 'straight' | 'curved-chord' | 'circle-bridge';
}

export interface RoboflowWallDetections {
  polygons: RoboflowWallPolygon[];
  /** Zero means the response did not contain dimensions (direct API shape). */
  imageWidth: number;
  imageHeight: number;
}

export interface RoboflowWallConnectorOptions {
  /** Required only to recover a filled connected-wall-network polygon. */
  isWallPixel?: (x: number, y: number) => boolean;
  /** Above this implied width a polygon is treated as a filled network. */
  maxWallThicknessPixels?: number;
}

const MAX_EDGE = 900;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: RoboflowPoint, b: RoboflowPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const weightedMedian = (values: Array<{ value: number; weight: number }>) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (!(total > 0)) return median(sorted.map(item => item.value));
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += Math.max(0, item.weight);
    if (accumulated >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
};
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))];
};

const collectPredictionBlocks = (value: unknown, blocks: Record<string, unknown>[], seen = new Set<object>(), depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 8 || seen.has(value as object)) return;
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach(item => collectPredictionBlocks(item, blocks, seen, depth + 1));
    return;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.predictions)) blocks.push(record);
  Object.values(record).forEach(item => collectPredictionBlocks(item, blocks, seen, depth + 1));
};

/** Accepts either the direct model API or any renamed Workflow output block. */
export const extractRoboflowWallPolygons = (payload: unknown): RoboflowWallDetections => {
  const blocks: Record<string, unknown>[] = [];
  collectPredictionBlocks(payload, blocks);
  let imageWidth = 0, imageHeight = 0;
  const polygons: RoboflowWallPolygon[] = [];
  const unique = new Set<string>();
  for (const block of blocks) {
    const image = block.image as Record<string, unknown> | undefined;
    if (!imageWidth && Number(image?.width) > 0 && Number(image?.height) > 0) {
      imageWidth = Number(image.width); imageHeight = Number(image.height);
    }
    for (const raw of block.predictions as unknown[]) {
      const prediction = raw as Record<string, unknown>;
      if (!prediction || !Array.isArray(prediction.points)) continue;
      const points = prediction.points.map(item => {
        const point = item as Record<string, unknown>;
        return { x: Number(point?.x), y: Number(point?.y) };
      }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (points.length < 3) continue;
      const key = String(prediction.detection_id || `${points[0].x},${points[0].y},${points.length}`);
      if (unique.has(key)) continue;
      unique.add(key);
      polygons.push({
        points,
        confidence: Number.isFinite(prediction.confidence) ? clamp(Number(prediction.confidence), 0, 1) : 0.8,
        class: String(prediction.class || 'wall'),
        detectionId: prediction.detection_id ? String(prediction.detection_id) : undefined,
      });
    }
  }
  const wallPolygons = polygons.filter(polygon => polygon.class.toLowerCase().includes('wall'));
  return { polygons: wallPolygons.length ? wallPolygons : polygons, imageWidth, imageHeight };
};

interface Raster { mask: Uint8Array; width: number; height: number; scale: number; offsetX: number; offsetY: number; filled: number }

const rasterize = (points: RoboflowPoint[], isWallPixel?: (x: number, y: number) => boolean): Raster | undefined => {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (!(maxX > minX && maxY > minY)) return undefined;
  const scale = Math.min(1, MAX_EDGE / Math.max(maxX - minX, maxY - minY));
  const margin = 2, width = Math.ceil((maxX - minX) * scale) + margin * 2, height = Math.ceil((maxY - minY) * scale) + margin * 2;
  const offsetX = minX - margin / scale, offsetY = minY - margin / scale;
  const local = points.map(point => ({ x: (point.x - offsetX) * scale, y: (point.y - offsetY) * scale }));
  const mask = new Uint8Array(width * height); let filled = 0;
  for (let y = 0; y < height; y++) {
    const intersections: number[] = [], scanY = y + 0.5;
    for (let index = 0; index < local.length; index++) {
      const a = local[index], b = local[(index + 1) % local.length];
      if ((a.y > scanY) === (b.y > scanY)) continue;
      intersections.push(a.x + (scanY - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      for (let x = Math.max(0, Math.ceil(intersections[index] - .5)); x <= Math.min(width - 1, Math.floor(intersections[index + 1] - .5)); x++) {
        if (isWallPixel && !isWallPixel(x / scale + offsetX, y / scale + offsetY)) continue;
        mask[y * width + x] = 1; filled++;
      }
    }
  }
  return filled ? { mask, width, height, scale, offsetX, offsetY, filled } : undefined;
};

const distanceTransform = (raster: Raster) => {
  const { mask, width, height } = raster, result = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) result[i] = mask[i] ? 1e9 : 0;
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height ? 0 : result[y * width + x];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) result[y * width + x] = Math.min(result[y * width + x], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) if (mask[y * width + x]) result[y * width + x] = Math.min(result[y * width + x], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  for (let i = 0; i < result.length; i++) result[i] /= 3;
  return result;
};

/**
 * A connected-instance mask can cover room interiors. After re-cutting it
 * against source ink, strip annotations and dimension strokes before finding
 * the medial axis; walls are materially wider than those marks.
 */
const dropThinStrokes = (raster: Raster): Raster | undefined => {
  const distances = distanceTransform(raster);
  const inkDistances: number[] = [];
  for (let index = 0; index < raster.mask.length; index++) if (raster.mask[index]) inkDistances.push(distances[index]);
  const threshold = Math.max(1, percentile(inkDistances, .85) * .3);
  const mask = new Uint8Array(raster.mask.length);
  let filled = 0;
  for (let index = 0; index < mask.length; index++) {
    if (raster.mask[index] && distances[index] >= threshold) {
      mask[index] = 1;
      filled++;
    }
  }
  return filled >= raster.filled * .05 ? { ...raster, mask, filled } : undefined;
};

const thin = (raster: Raster) => {
  const image = Uint8Array.from(raster.mask), { width, height } = raster;
  const at = (x: number, y: number) => image[y * width + x];
  for (let iteration = 0, changed = true; changed && iteration < 200; iteration++) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const remove: number[] = [];
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        if (!at(x, y)) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2], neighbours = ring.slice(0, 8).reduce((sum, v) => sum + v, 0);
        const transitions = ring.slice(0, 8).reduce((sum, value, index) => sum + (!value && ring[index + 1] ? 1 : 0), 0);
        if (neighbours < 2 || neighbours > 6 || transitions !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        remove.push(y * width + x);
      }
      if (remove.length) { changed = true; remove.forEach(index => { image[index] = 0; }); }
    }
  }
  return image;
};

const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const tracePaths = (skeleton: Uint8Array, width: number, height: number, suppressDiagonalTriangles = false) => {
  const adjacent = (index: number) => {
    const x = index % width, y = Math.floor(index / width);
    return neighbours.flatMap(([dx, dy]) => {
      const nextX = x + dx, nextY = y + dy, next = nextY * width + nextX;
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height || !skeleton[next]) return [];
      if (suppressDiagonalTriangles && dx !== 0 && dy !== 0) {
        // An eight-neighbour diagonal plus either adjacent orthogonal edge
        // forms a one-pixel triangle on staircase-shaped diagonal skeletons.
        // Treating that triangle as a real junction is what shatters angular
        // walls into dozens of tiny paths.
        const horizontal = y * width + nextX;
        const vertical = nextY * width + x;
        if (skeleton[horizontal] || skeleton[vertical]) return [];
      }
      return [next];
    });
  };
  const pixels = [...skeleton.keys()].filter(index => skeleton[index]), degree = new Uint8Array(skeleton.length);
  pixels.forEach(index => { degree[index] = adjacent(index).length; });
  const used = new Set<string>(), key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const paths: { points: RoboflowPoint[]; firstDegree: number; lastDegree: number }[] = [];
  const walk = (start: number, first: number) => {
    const points = [{ x: start % width, y: Math.floor(start / width) }]; let previous = start, current = first;
    used.add(key(previous, current));
    for (let guard = 0; guard < pixels.length + 1; guard++) {
      points.push({ x: current % width, y: Math.floor(current / width) });
      if (degree[current] !== 2) break;
      const next = adjacent(current).find(candidate => candidate !== previous && !used.has(key(current, candidate)));
      if (next === undefined) break;
      used.add(key(current, next)); previous = current; current = next;
    }
    if (points.length > 1) paths.push({ points, firstDegree: degree[start], lastDegree: degree[current] });
  };
  for (const start of [...pixels.filter(index => degree[index] !== 2), ...pixels.filter(index => degree[index] === 2)]) for (const next of adjacent(start)) if (!used.has(key(start, next))) walk(start, next);
  return paths;
};

const simplify = (points: RoboflowPoint[], epsilon: number): RoboflowPoint[] => {
  if (points.length < 3) return points;
  const first = points[0], last = points[points.length - 1], span = distance(first, last);
  let worst = 0, worstIndex = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const d = span < 1e-8 ? distance(point, first) : Math.abs((last.y - first.y) * point.x - (last.x - first.x) * point.y + last.x * first.y - last.y * first.x) / span;
    if (d > worst) { worst = d; worstIndex = index; }
  }
  return worst <= epsilon ? [first, last] : [...simplify(points.slice(0, worstIndex + 1), epsilon).slice(0, -1), ...simplify(points.slice(worstIndex), epsilon)];
};

/** Preserve the ends of small curved pieces instead of dropping them outright. */
const mergeShortSegments = (points: RoboflowPoint[], minLength: number): RoboflowPoint[] => {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const previous = result[result.length - 1];
    if (distance(points[index], previous) >= minLength) result.push(points[index]);
  }
  const last = points[points.length - 1];
  if (result.length > 1 && distance(last, result[result.length - 1]) < minLength) result.pop();
  result.push(last);
  return result;
};

/** Thinning pulls a medial axis in from every free edge; restore that extent. */
const extendFreeEnd = (endpoint: RoboflowPoint, anchor: RoboflowPoint, raster: Raster, maximum: number) => {
  const dx = endpoint.x - anchor.x, dy = endpoint.y - anchor.y, length = Math.hypot(dx, dy);
  if (length <= 1e-6) return endpoint;
  const unit = { x: dx / length, y: dy / length };
  let result = endpoint;
  for (let step = 1; step <= maximum; step++) {
    const x = Math.round(endpoint.x + unit.x * step), y = Math.round(endpoint.y + unit.y * step);
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height || !raster.mask[y * raster.width + x]) break;
    result = { x: endpoint.x + unit.x * step, y: endpoint.y + unit.y * step };
  }
  return result;
};

const impliedThickness = (points: RoboflowPoint[]) => {
  let doubleArea = 0, perimeter = 0;
  for (let index = 0; index < points.length; index++) { const a = points[index], b = points[(index + 1) % points.length]; doubleArea += a.x * b.y - b.x * a.y; perimeter += distance(a, b); }
  return perimeter > 1e-8 ? Math.abs(doubleArea) / perimeter : Infinity;
};

/**
 * A few high-confidence segmentation instances contain a thick, joined angled
 * wall network. Eight-neighbour thinning turns those filled diagonal regions
 * into hundreds of tiny branch paths, so the ordinary skeleton route can leave
 * only one implausibly short survivor. Recover one dominant diagonal centreline
 * only under that narrow, measurable failure signature.
 */
export const recoverCollapsedAngledWall = (
  polygon: RoboflowWallPolygon,
  emitted: RoboflowWallCenterline[],
  polygonIndex: number,
): RoboflowWallCenterline | undefined => {
  if (polygon.confidence < .9 || emitted.length > 1 || polygon.points.length < 40) return undefined;
  const thickness = impliedThickness(polygon.points);
  if (!(thickness > 0 && Number.isFinite(thickness))) return undefined;
  const center = polygon.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= polygon.points.length;
  center.y /= polygon.points.length;
  let xx = 0, yy = 0, xy = 0;
  polygon.points.forEach(point => {
    const x = point.x - center.x, y = point.y - center.y;
    xx += x * x; yy += y * y; xy += x * y;
  });
  xx /= polygon.points.length; yy /= polygon.points.length; xy /= polygon.points.length;
  const discriminant = Math.hypot(xx - yy, 2 * xy);
  const majorSpread = Math.sqrt(Math.max(0, (xx + yy + discriminant) / 2));
  const minorSpread = Math.sqrt(Math.max(0, (xx + yy - discriminant) / 2));
  if (!(majorSpread >= thickness * 3 && majorSpread / Math.max(1, minorSpread) >= 2.2
    && minorSpread <= thickness * 2.2)) return undefined;
  const angle = .5 * Math.atan2(2 * xy, xx - yy);
  const unit = { x: Math.cos(angle), y: Math.sin(angle) };
  const axisDrift = Math.min(
    Math.abs(Math.atan2(unit.y, unit.x) * 180 / Math.PI) % 90,
    90 - (Math.abs(Math.atan2(unit.y, unit.x) * 180 / Math.PI) % 90),
  );
  // This is an angled-network escape hatch, never an alternate route for a
  // conventional horizontal/vertical wall.
  if (axisDrift < 15) return undefined;
  const projections = polygon.points.map(point => (point.x - center.x) * unit.x + (point.y - center.y) * unit.y);
  const startProjection = Math.min(...projections), endProjection = Math.max(...projections);
  const span = endProjection - startProjection;
  const longestSurvivor = emitted.reduce((longest, wall) => Math.max(longest, distance(wall.p1, wall.p2)), 0);
  if (span < thickness * 6 || longestSurvivor >= span * .35) return undefined;
  return {
    id: `roboflow-angled-fallback-${polygonIndex + 1}`,
    p1: { x: center.x + unit.x * startProjection, y: center.y + unit.y * startProjection },
    p2: { x: center.x + unit.x * endProjection, y: center.y + unit.y * endProjection },
    confidence: polygon.confidence,
    thicknessPixels: thickness,
    polygonIndex,
    geometryKind: 'straight',
  };
};

/** Preserve a single slender wall mask that the skeleton pruned completely. */
export const recoverCollapsedSimpleWall = (
  polygon: RoboflowWallPolygon,
  emitted: RoboflowWallCenterline[],
  polygonIndex: number,
): RoboflowWallCenterline | undefined => {
  if (emitted.length || polygon.confidence < .5 || polygon.points.length < 12) return undefined;
  const thickness = impliedThickness(polygon.points);
  if (!(thickness > 0 && Number.isFinite(thickness))) return undefined;
  const center = polygon.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= polygon.points.length;
  center.y /= polygon.points.length;
  let xx = 0, yy = 0, xy = 0;
  polygon.points.forEach(point => {
    const x = point.x - center.x, y = point.y - center.y;
    xx += x * x; yy += y * y; xy += x * y;
  });
  xx /= polygon.points.length; yy /= polygon.points.length; xy /= polygon.points.length;
  const discriminant = Math.hypot(xx - yy, 2 * xy);
  const majorSpread = Math.sqrt(Math.max(0, (xx + yy + discriminant) / 2));
  const minorSpread = Math.sqrt(Math.max(0, (xx + yy - discriminant) / 2));
  if (!(majorSpread / Math.max(1, minorSpread) >= 2.1 && minorSpread <= thickness * 1.15)) return undefined;
  const angle = .5 * Math.atan2(2 * xy, xx - yy);
  const unit = { x: Math.cos(angle), y: Math.sin(angle) };
  const projections = polygon.points.map(point => (point.x - center.x) * unit.x + (point.y - center.y) * unit.y);
  const startProjection = Math.min(...projections), endProjection = Math.max(...projections);
  if (endProjection - startProjection < Math.max(12, thickness * 3.5)) return undefined;
  return {
    id: `roboflow-simple-fallback-${polygonIndex + 1}`,
    p1: { x: center.x + unit.x * startProjection, y: center.y + unit.y * startProjection },
    p2: { x: center.x + unit.x * endProjection, y: center.y + unit.y * endProjection },
    confidence: polygon.confidence,
    thicknessPixels: thickness,
    polygonIndex,
    geometryKind: 'straight',
  };
};

interface CircularBoundary {
  center: RoboflowPoint;
  radius: number;
}

const TAU = Math.PI * 2;
const normaliseAngle = (angle: number) => angle < 0 ? angle + TAU : angle;

const convexHull = (points: RoboflowPoint[]) => {
  const unique = [...new Map(points.map(point => [`${point.x},${point.y}`, point])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length < 3) return unique;
  const turn = (a: RoboflowPoint, b: RoboflowPoint, c: RoboflowPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: RoboflowPoint[] = [];
  unique.forEach(point => {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper: RoboflowPoint[] = [];
  [...unique].reverse().forEach(point => {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

/**
 * Circle repair is deliberately opt-in. A near-square plan is not enough: the
 * outer Roboflow contour must also put substantial, evenly spread evidence at
 * one common radius. This prevents rectangular plans from being rounded.
 */
export const inferCircularBoundary = (polygons: RoboflowWallPolygon[]): CircularBoundary | undefined => {
  const points = polygons.flatMap(polygon => polygon.points);
  if (points.length < 24) return undefined;
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const width = maxX - minX, height = maxY - minY;
  if (width <= 0 || height <= 0 || width / height < .8 || width / height > 1.25) return undefined;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  // Do not infer a circle from every segmentation vertex. A rectangular plan
  // with many interior walls can be roughly square and still scatter points at
  // several radii around its centre. Its *convex outer contour* is the signal:
  // a real circular shell has a dense, smooth hull at one radius and covers
  // almost every angle, whereas a rectangular shell has corners and long flats.
  const hull = convexHull(points);
  if (hull.length < 20) return undefined;
  const radii = hull.map(point => Math.hypot(point.x - center.x, point.y - center.y));
  const radius = median(radii);
  if (radius <= 1) return undefined;
  const meanRelativeError = radii.reduce((sum, value) => sum + Math.abs(value - radius) / radius, 0) / radii.length;
  const angularCoverage = new Set(hull
    .filter(point => Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - radius) / radius < .06)
    .map(point => Math.floor(normaliseAngle(Math.atan2(point.y - center.y, point.x - center.x)) / (Math.PI * 2) * 16)));
  const hullPerimeter = hull.reduce((sum, point, index) => sum + distance(point, hull[(index + 1) % hull.length]), 0);
  const perimeterRatio = hullPerimeter / (Math.PI * 2 * radius);
  return meanRelativeError <= .055 && angularCoverage.size >= 11 && perimeterRatio >= .9 && perimeterRatio <= 1.05
    ? { center, radius }
    : undefined;
};

/**
 * Circular plans can contain a second, concentric wall family (a rotunda or
 * circulation core). The outer convex hull can only identify the shell, so
 * search the remaining polygon evidence for a well-distributed radial band.
 * Radial walls cross many radii but occupy very few angles; a genuine nested
 * circle occupies most angular sectors at one stable radius.
 */
export const inferNestedCircularBoundaries = (
  polygons: RoboflowWallPolygon[],
  outer: CircularBoundary | undefined,
): CircularBoundary[] => {
  if (!outer) return [];
  const points = polygons.flatMap(polygon => polygon.points);
  const radial = points.map(point => ({
    point,
    radius: distance(point, outer.center),
    angle: normaliseAngle(Math.atan2(point.y - outer.center.y, point.x - outer.center.x)),
  })).filter(sample => sample.radius >= outer.radius * .12 && sample.radius <= outer.radius * .68);
  if (radial.length < 36) return [];
  const step = Math.max(2, outer.radius * .006);
  const candidates: Array<{ radius: number; score: number; coverage: number; matches: number }> = [];
  for (let radius = outer.radius * .14; radius <= outer.radius * .65; radius += step) {
    const tolerance = Math.max(5, radius * .105);
    const matches = radial.filter(sample => Math.abs(sample.radius - radius) <= tolerance);
    if (matches.length < 28) continue;
    const sectors = new Set(matches.map(sample => Math.floor(sample.angle / TAU * 24)));
    if (sectors.size < 12) continue;
    const meanError = matches.reduce((sum, sample) => sum + Math.abs(sample.radius - radius), 0) / matches.length;
    const score = sectors.size * 100 + Math.min(99, matches.length) - meanError / tolerance * 20;
    candidates.push({ radius, score, coverage: sectors.size, matches: matches.length });
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected: CircularBoundary[] = [];
  for (const candidate of candidates) {
    if (selected.some(circle => Math.abs(circle.radius - candidate.radius) <= Math.max(12, candidate.radius * .18))) continue;
    const tolerance = Math.max(5, candidate.radius * .105);
    const band = radial.filter(sample => Math.abs(sample.radius - candidate.radius) <= tolerance);
    const refinedRadius = median(band.map(sample => sample.radius));
    if (!(refinedRadius > outer.radius * .12 && refinedRadius < outer.radius * .7)) continue;
    selected.push({ center: { ...outer.center }, radius: refinedRadius });
    // Multiple nested rings are valid but uncommon; bounding the search keeps
    // unrelated furniture circles from entering wall conversion.
    if (selected.length >= 2) break;
  }
  // A thick circular mask contributes two dense radial bands: its inner and
  // outer faces. They describe one wall centreline, not two concentric walls.
  // Merge only bands close enough to be the two faces of one ordinary wall;
  // genuinely separate nested rings remain independent.
  const ordered = selected.sort((a, b) => a.radius - b.radius);
  const merged: CircularBoundary[] = [];
  ordered.forEach(circle => {
    const previous = merged[merged.length - 1];
    const facePairTolerance = Math.max(12, Math.min(previous?.radius ?? circle.radius, circle.radius) * .25);
    if (previous && circle.radius - previous.radius <= facePairTolerance) {
      previous.radius = (previous.radius + circle.radius) / 2;
    } else {
      merged.push({ center: { ...circle.center }, radius: circle.radius });
    }
  });
  return merged;
};

interface WallEndpoint {
  id: string;
  point: RoboflowPoint;
  wall: RoboflowWallCenterline;
  angle: number;
  radius: number;
}

const isTangentialToCircle = (endpoint: WallEndpoint, circle: CircularBoundary) => {
  const dx = endpoint.wall.p2.x - endpoint.wall.p1.x;
  const dy = endpoint.wall.p2.y - endpoint.wall.p1.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-6) return false;
  const radialX = (endpoint.point.x - circle.center.x) / endpoint.radius;
  const radialY = (endpoint.point.y - circle.center.y) / endpoint.radius;
  // The sign does not matter: either direction along a wall is tangential.
  return Math.abs((dx / length) * -radialY + (dy / length) * radialX) >= .65;
};

/**
 * Decide at path level rather than polygon level. A single Roboflow instance
 * can contain an exterior arc and connected radial/orthogonal walls, so marking
 * the complete polygon "curved" would also weaken filtering for its straight
 * junction spokes.
 */
const pathFollowsCircularBoundary = (
  points: RoboflowPoint[],
  raster: Raster,
  circles: CircularBoundary[],
) => {
  if (!circles.length || points.length < 2) return undefined;
  const sourcePoints = points.map(point => ({
    x: point.x / raster.scale + raster.offsetX,
    y: point.y / raster.scale + raster.offsetY,
  }));
  const circle = [...circles].sort((first, second) => {
    const firstMatches = sourcePoints.filter(point =>
      Math.abs(distance(point, first.center) - first.radius) / first.radius <= .09).length;
    const secondMatches = sourcePoints.filter(point =>
      Math.abs(distance(point, second.center) - second.radius) / second.radius <= .09).length;
    return secondMatches - firstMatches;
  })[0];
  const radialMatches = sourcePoints.filter(point =>
    Math.abs(distance(point, circle.center) - circle.radius) / circle.radius <= .09).length;
  if (radialMatches / sourcePoints.length < .7) return undefined;

  const start = sourcePoints[0], end = sourcePoints[sourcePoints.length - 1];
  const chordLength = distance(start, end);
  if (chordLength <= 1e-6) return undefined;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const radialLength = distance(midpoint, circle.center);
  if (radialLength <= 1e-6) return undefined;
  const chord = { x: (end.x - start.x) / chordLength, y: (end.y - start.y) / chordLength };
  const radial = { x: (midpoint.x - circle.center.x) / radialLength, y: (midpoint.y - circle.center.y) / radialLength };
  const tangentAlignment = Math.abs(chord.x * -radial.y + chord.y * radial.x);
  // A long vertical/horizontal exterior run can be tangent to the inferred
  // circle without being curved. Require measurable bowing away from its own
  // endpoint chord before assigning curved geometry. Very short true arc
  // pieces may remain straight chords, which is faithful and preferable to
  // bending an actually straight wall.
  const chordDeviation = sourcePoints.reduce((maximum, point) => {
    const deviation = Math.abs((point.x - start.x) * chord.y - (point.y - start.y) * chord.x);
    return Math.max(maximum, deviation);
  }, 0);
  const nestedCircle = circle !== circles[0];
  // Thinning a compact annular mask often traces it as several short, exactly
  // straight tangent chords. Once a separate nested radial band has been
  // verified, those short chords are legitimate curve samples even though an
  // individual sample has no measurable bow. This exception never applies to
  // the outer shell or to long straight/tangent walls.
  const supportedNestedChord = nestedCircle
    && tangentAlignment >= .78
    && chordLength <= circle.radius * .38;
  return tangentAlignment >= .6
    && (chordDeviation >= Math.max(1.25, chordLength * .012) || supportedNestedChord)
    ? circle
    : undefined;
};

type StraightAxis = 'horizontal' | 'vertical';

interface StraightAxisCandidate {
  wallIndex: number;
  axis: StraightAxis;
  length: number;
  thickness: number;
  normal: number;
  intervalStart: number;
  intervalEnd: number;
}

const straightAxisCandidate = (wall: RoboflowWallCenterline, wallIndex: number): StraightAxisCandidate | undefined => {
  if (wall.geometryKind !== 'straight') return undefined;
  const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y;
  const length = Math.hypot(dx, dy);
  const thickness = Math.max(1, wall.thicknessPixels || 1);
  if (length < Math.max(6, thickness * 1.4)) return undefined;
  let angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 180;
  if (angle > 90) angle = 180 - angle;
  const horizontalDrift = angle;
  const verticalDrift = Math.abs(90 - angle);
  const drift = Math.min(horizontalDrift, verticalDrift);
  // A small skeleton run needs stronger axis evidence than a long wall. The
  // grey zone recovers visibly sloped long walls without orthogonalising the
  // genuine bay/diagonal families in the same floorplan.
  if (drift > 4 && !(drift <= 8 && length >= thickness * 3)) return undefined;
  const axis: StraightAxis = horizontalDrift <= verticalDrift ? 'horizontal' : 'vertical';
  return {
    wallIndex,
    axis,
    length,
    thickness,
    normal: axis === 'horizontal' ? (wall.p1.y + wall.p2.y) / 2 : (wall.p1.x + wall.p2.x) / 2,
    intervalStart: axis === 'horizontal' ? Math.min(wall.p1.x, wall.p2.x) : Math.min(wall.p1.y, wall.p2.y),
    intervalEnd: axis === 'horizontal' ? Math.max(wall.p1.x, wall.p2.x) : Math.max(wall.p1.y, wall.p2.y),
  };
};

const infiniteLineIntersection = (
  first: RoboflowWallCenterline,
  second: RoboflowWallCenterline,
): RoboflowPoint | undefined => {
  const ax = first.p2.x - first.p1.x, ay = first.p2.y - first.p1.y;
  const bx = second.p2.x - second.p1.x, by = second.p2.y - second.p1.y;
  const denominator = ax * by - ay * bx;
  if (Math.abs(denominator) <= 1e-8) return undefined;
  const qx = second.p1.x - first.p1.x, qy = second.p1.y - first.p1.y;
  const t = (qx * by - qy * bx) / denominator;
  return { x: first.p1.x + ax * t, y: first.p1.y + ay * t };
};

/**
 * Remove medial-axis drift from a non-circular wall network without changing
 * its topology. Axis-like runs share a robust common x/y, genuine angular runs
 * remain untouched, and only wall-thickness-sized endpoint gaps are closed.
 * Segment count and ordering are invariant so Hybrid can preserve the result.
 */
export const normalizeStraightWallNetwork = (walls: RoboflowWallCenterline[]) => {
  if (walls.length < 2) return walls;
  const normalized = walls.map(wall => ({
    ...wall,
    p1: { ...wall.p1 },
    p2: { ...wall.p2 },
  }));
  const candidates = normalized.flatMap((wall, index) => {
    const candidate = straightAxisCandidate(wall, index);
    return candidate ? [candidate] : [];
  });
  if (!candidates.length) return normalized;

  // Cluster fragments that describe the same horizontal/vertical run. The
  // longitudinal allowance may span a normal window/door gap; it aligns the
  // two jamb-side fragments but does not join or fill that gap.
  const parents = candidates.map((_, index) => index);
  const root = (index: number): number => parents[index] === index ? index : (parents[index] = root(parents[index]));
  const unite = (first: number, second: number) => {
    const a = root(first), b = root(second);
    if (a !== b) parents[b] = a;
  };
  for (let first = 0; first < candidates.length; first++) {
    for (let second = first + 1; second < candidates.length; second++) {
      const a = candidates[first], b = candidates[second];
      if (a.axis !== b.axis) continue;
      const normalTolerance = Math.max(3, Math.max(a.thickness, b.thickness) * 1.6);
      if (Math.abs(a.normal - b.normal) > normalTolerance) continue;
      const longitudinalGap = Math.max(0, Math.max(a.intervalStart, b.intervalStart) - Math.min(a.intervalEnd, b.intervalEnd));
      if (longitudinalGap <= Math.max(48, Math.max(a.thickness, b.thickness) * 5)) unite(first, second);
    }
  }
  const groups = new Map<number, StraightAxisCandidate[]>();
  candidates.forEach((candidate, index) => {
    const key = root(index);
    groups.set(key, [...(groups.get(key) || []), candidate]);
  });
  groups.forEach(group => {
    const target = weightedMedian(group.map(candidate => ({
      value: candidate.normal,
      weight: candidate.length * Math.max(.2, normalized[candidate.wallIndex].confidence),
    })));
    group.forEach(candidate => {
      const wall = normalized[candidate.wallIndex];
      if (candidate.axis === 'horizontal') wall.p1.y = wall.p2.y = target;
      else wall.p1.x = wall.p2.x = target;
    });
  });

  type EndpointKey = 'p1' | 'p2';
  interface EndpointProposal { point: RoboflowPoint; movement: number }
  const proposals = new Map<string, EndpointProposal>();
  const propose = (wallIndex: number, endpoint: EndpointKey, point: RoboflowPoint) => {
    const current = normalized[wallIndex][endpoint];
    const movement = distance(current, point);
    const key = `${wallIndex}:${endpoint}`;
    const previous = proposals.get(key);
    if (!previous || movement < previous.movement) proposals.set(key, { point, movement });
  };
  const closestEndpoint = (wall: RoboflowWallCenterline, point: RoboflowPoint) => {
    const first = distance(wall.p1, point), second = distance(wall.p2, point);
    return first <= second
      ? { endpoint: 'p1' as EndpointKey, distance: first }
      : { endpoint: 'p2' as EndpointKey, distance: second };
  };
  const candidateByWall = new Map(candidates.map(candidate => [candidate.wallIndex, candidate]));
  for (let firstIndex = 0; firstIndex < normalized.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < normalized.length; secondIndex++) {
      const first = normalized[firstIndex], second = normalized[secondIndex];
      if (first.geometryKind !== 'straight' || second.geometryKind !== 'straight') continue;
      const firstLength = distance(first.p1, first.p2), secondLength = distance(second.p1, second.p2);
      const typicalThickness = Math.max(1, first.thicknessPixels, second.thicknessPixels);
      if (firstLength < typicalThickness * 1.5 || secondLength < typicalThickness * 1.5) continue;
      const firstVector = { x: (first.p2.x - first.p1.x) / firstLength, y: (first.p2.y - first.p1.y) / firstLength };
      const secondVector = { x: (second.p2.x - second.p1.x) / secondLength, y: (second.p2.y - second.p1.y) / secondLength };
      const cross = Math.abs(firstVector.x * secondVector.y - firstVector.y * secondVector.x);

      if (cross < Math.sin(12 * Math.PI / 180)) {
        // Close only a tiny collinear skeleton break. Door/window gaps are
        // materially larger and therefore remain exactly as Roboflow supplied.
        const firstAxis = candidateByWall.get(firstIndex), secondAxis = candidateByWall.get(secondIndex);
        if (!firstAxis || !secondAxis || firstAxis.axis !== secondAxis.axis) continue;
        const firstNormal = firstAxis.axis === 'horizontal' ? (first.p1.y + first.p2.y) / 2 : (first.p1.x + first.p2.x) / 2;
        const secondNormal = secondAxis.axis === 'horizontal' ? (second.p1.y + second.p2.y) / 2 : (second.p1.x + second.p2.x) / 2;
        // Same orientation is not enough: two close parallel walls must remain
        // separate. Only fragments already snapped onto one identical axis may
        // share an endpoint.
        if (Math.abs(firstNormal - secondNormal) > .25) continue;
        const endpointPairs: Array<[EndpointKey, EndpointKey]> = [['p1', 'p1'], ['p1', 'p2'], ['p2', 'p1'], ['p2', 'p2']];
        const closest = endpointPairs.map(([a, b]) => ({ a, b, gap: distance(first[a], second[b]) }))
          .sort((a, b) => a.gap - b.gap)[0];
        if (closest.gap > Math.max(2, typicalThickness * .75)) continue;
        const midpoint = {
          x: (first[closest.a].x + second[closest.b].x) / 2,
          y: (first[closest.a].y + second[closest.b].y) / 2,
        };
        propose(firstIndex, closest.a, midpoint);
        propose(secondIndex, closest.b, midpoint);
        continue;
      }

      const intersection = infiniteLineIntersection(first, second);
      if (!intersection) continue;
      const firstEnd = closestEndpoint(first, intersection), secondEnd = closestEndpoint(second, intersection);
      const junctionTolerance = Math.max(4, typicalThickness * 1.75);
      const firstNear = firstEnd.distance <= junctionTolerance;
      const secondNear = secondEnd.distance <= junctionTolerance;
      // An L corner has two nearby ends; a T junction has one nearby branch end
      // and an intersection inside the other segment. Do nothing when both
      // infinite lines merely cross far away from their finite wall geometry.
      if (!firstNear && !secondNear) continue;
      const pointToSegmentDistance = (wall: RoboflowWallCenterline) => {
        const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared > 0 ? clamp(((intersection.x - wall.p1.x) * dx + (intersection.y - wall.p1.y) * dy) / lengthSquared, 0, 1) : 0;
        return distance(intersection, { x: wall.p1.x + dx * t, y: wall.p1.y + dy * t });
      };
      if (pointToSegmentDistance(first) > junctionTolerance || pointToSegmentDistance(second) > junctionTolerance) continue;
      if (firstNear) propose(firstIndex, firstEnd.endpoint, intersection);
      if (secondNear) propose(secondIndex, secondEnd.endpoint, intersection);
    }
  }
  proposals.forEach((proposal, key) => {
    const [wallIndex, endpoint] = key.split(':') as [string, EndpointKey];
    normalized[Number(wallIndex)][endpoint] = proposal.point;
  });
  return normalized;
};

/**
 * Complete short missing spans in a circular wall with several small straight
 * segments. Native JSON stores straight walls, so this is the faithful way to
 * retain the detected arc rather than adding one visibly flat diagonal.
 */
const bridgeCircularWallGaps = (
  walls: RoboflowWallCenterline[],
  polygons: RoboflowWallPolygon[],
  isWallPixel?: (x: number, y: number) => boolean,
) => {
  const circle = inferCircularBoundary(polygons);
  if (!circle || walls.length < 3) return;
  const evidenceIntervals = circularPolygonIntervals(polygons, circle);
  const hasAngularSupport = (angle: number) => {
    const normalized = normaliseAngle(angle);
    return evidenceIntervals.some(interval => normalized >= interval.start && normalized <= interval.end);
  };
  const typicalThickness = median(walls.map(wall => wall.thicknessPixels).filter(value => Number.isFinite(value) && value > 0));
  const endpointTolerance = Math.max(2, typicalThickness * .35);
  const everyEndpoint = walls.flatMap(wall => [
    { id: `${wall.id}:start`, point: wall.p1, wall },
    { id: `${wall.id}:end`, point: wall.p2, wall },
  ]);
  const freeEndpoints: WallEndpoint[] = everyEndpoint.flatMap((candidate, index) => {
    if (everyEndpoint.some((other, otherIndex) => otherIndex !== index && distance(candidate.point, other.point) <= endpointTolerance)) return [];
    const radius = distance(candidate.point, circle.center);
    if (Math.abs(radius - circle.radius) / circle.radius > .12) return [];
    const endpoint: WallEndpoint = {
      ...candidate,
      angle: normaliseAngle(Math.atan2(candidate.point.y - circle.center.y, candidate.point.x - circle.center.x)),
      radius,
    };
    return isTangentialToCircle(endpoint, circle) ? [endpoint] : [];
  });
  if (freeEndpoints.length < 4) return;

  freeEndpoints.sort((a, b) => a.angle - b.angle);
  const maxGap = Math.PI * 42 / 180;
  const stepAngle = Math.PI * 5 / 180;
  for (let index = 0; index < freeEndpoints.length; index++) {
    const start = freeEndpoints[index];
    const end = freeEndpoints[(index + 1) % freeEndpoints.length];
    // The two ends of an already-detected arc are adjacent in angular order;
    // never draw a duplicate chord through its interior.
    if (start.wall.polygonIndex === end.wall.polygonIndex) continue;
    const gap = (end.angle - start.angle + Math.PI * 2) % (Math.PI * 2);
    if (gap <= .01 || gap > maxGap) continue;
    // Endpoint proximity alone cannot distinguish a thinning crack from a
    // real door/window aperture. Bridge only when the Roboflow polygon contour
    // itself continuously supports the missing angular span. A blank span in
    // the segmentation mask is authoritative and must remain available for a
    // Local opening in Hybrid.
    const supportSamples = 9;
    let supported = 0;
    for (let sample = 1; sample < supportSamples; sample++) {
      if (hasAngularSupport(start.angle + gap * sample / supportSamples)) supported++;
    }
    let rasterBandSupport = 0;
    if (isWallPixel && supported < supportSamples - 2) {
      let dark = 0, total = 0;
      const halfBand = Math.max(3, typicalThickness * .62);
      const radialSamples = 9;
      for (let sample = 1; sample < supportSamples; sample++) {
        const angle = start.angle + gap * sample / supportSamples;
        for (let radial = 0; radial < radialSamples; radial++) {
          const offset = (radial / (radialSamples - 1) - .5) * 2 * halfBand;
          const radius = circle.radius + offset;
          total++;
          if (isWallPixel(
            circle.center.x + Math.cos(angle) * radius,
            circle.center.y + Math.sin(angle) * radius,
          )) dark++;
        }
      }
      rasterBandSupport = total ? dark / total : 0;
    }
    // Thick source-wall ink can repair a detector dropout. Thin window-frame
    // strokes occupy too little of the radial band to pass this threshold, so
    // their apertures remain open even when the source contains visible lines.
    if (supported < supportSamples - 2 && rasterBandSupport < .46) continue;
    const steps = Math.max(1, Math.ceil(gap / stepAngle));
    let previous = start.point;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const angle = start.angle + gap * t;
      const radius = start.radius + (end.radius - start.radius) * t;
      const next = step === steps ? end.point : {
        x: circle.center.x + Math.cos(angle) * radius,
        y: circle.center.y + Math.sin(angle) * radius,
      };
      if (distance(previous, next) > 1e-6 && walls.length < 4000) {
        walls.push({
          id: `roboflow-circle-bridge-${walls.length + 1}`,
          p1: previous,
          p2: next,
          confidence: Math.min(start.wall.confidence, end.wall.confidence) * .96,
          thicknessPixels: typicalThickness || Math.min(start.wall.thicknessPixels, end.wall.thicknessPixels),
          polygonIndex: -1,
          geometryKind: 'circle-bridge',
        });
      }
      previous = next;
    }
  }
};

interface AngularInterval { start: number; end: number }

const circularPolygonIntervals = (
  polygons: RoboflowWallPolygon[],
  circle: CircularBoundary,
): AngularInterval[] => polygons.flatMap(polygon => {
  const fullTurn = Math.PI * 2;
  if (polygon.points.length < 12 || polygon.confidence < .5) return [];
  const radial = polygon.points.map(point => ({
    point,
    radius: distance(point, circle.center),
  }));
  const nearRing = radial.filter(sample => Math.abs(sample.radius - circle.radius) / circle.radius <= .1);
  // Radial/interior walls may touch the shell at one end. Require most of the
  // mask contour to live on the inferred ring before treating it as an arc.
  if (nearRing.length / radial.length < .55 || nearRing.length < 10) return [];
  const angles = nearRing
    .map(sample => normaliseAngle(Math.atan2(sample.point.y - circle.center.y, sample.point.x - circle.center.x)))
    .sort((a, b) => a - b);
  // Do not bridge a straight/chamfered exterior run merely because its two
  // ends happen to meet the same inferred circle. Only contiguous angular
  // support from the actual polygon contour may become a normalized arc.
  const maximumEvidenceGap = Math.max(Math.PI * 2.5 / 180, 6 / circle.radius);
  const breaks: number[] = [];
  for (let index = 0; index < angles.length; index++) {
    const next = index === angles.length - 1 ? angles[0] + fullTurn : angles[index + 1];
    if (next - angles[index] > maximumEvidenceGap) breaks.push(index);
  }
  if (!breaks.length) return [{ start: 0, end: fullTurn }];
  return breaks.flatMap((breakIndex, position) => {
    const nextBreak = breaks[(position + 1) % breaks.length];
    const startIndex = (breakIndex + 1) % angles.length;
    const start = angles[startIndex];
    let end = angles[nextBreak];
    if (nextBreak < startIndex || (position === breaks.length - 1 && end < start)) end += fullTurn;
    const span = end - start;
    if (span < Math.PI * 2 / 180 || span > fullTurn * .995) return [];
    return end <= fullTurn
      ? [{ start, end }]
      : [{ start, end: fullTurn }, { start: 0, end: end - fullTurn }];
  });
});

/**
 * Skeleton paths contain pixel-scale curve fragments with inconsistent lengths.
 * Importing each fragment as a wall makes a 0.12 m chord receive a normal wall
 * thickness and render as a block. Re-sample only the circular paths into
 * contiguous, uniform chords; straight/radial walls remain completely separate.
 */
const normalizeCircularChords = (
  walls: RoboflowWallCenterline[],
  circle: CircularBoundary | undefined,
  polygons: RoboflowWallPolygon[],
  isWallPixel?: (x: number, y: number) => boolean,
) => {
  if (!circle) return walls;
  const radialTolerance = .16;
  const circular = walls.filter(wall => wall.geometryKind !== 'straight'
    && [wall.p1, wall.p2].every(point => Math.abs(distance(point, circle.center) - circle.radius) / circle.radius <= radialTolerance));
  if (circular.length < 3) return walls;
  const typicalThickness = median(circular.map(wall => wall.thicknessPixels).filter(value => Number.isFinite(value) && value > 0));
  const rasterIntervals = (): AngularInterval[] => {
    if (!isWallPixel) return [];
    const bins = 720;
    const radialSamples = 9;
    const halfBand = Math.max(3, typicalThickness * .62);
    const supported = Array.from({ length: bins }, (_, index) => {
      const angle = index / bins * TAU;
      let dark = 0;
      for (let radial = 0; radial < radialSamples; radial++) {
        const offset = (radial / (radialSamples - 1) - .5) * 2 * halfBand;
        const radius = circle.radius + offset;
        if (isWallPixel(
          circle.center.x + Math.cos(angle) * radius,
          circle.center.y + Math.sin(angle) * radius,
        )) dark++;
      }
      return dark / radialSamples >= .46;
    });
    if (!supported.some(Boolean)) return [];
    // Start immediately after an unsupported bin so wrap-around wall runs are
    // emitted as one interval rather than two unrelated pieces.
    const firstBreak = supported.findIndex(value => !value);
    if (firstBreak < 0) return [{ start: 0, end: TAU }];
    const intervals: AngularInterval[] = [];
    let runStart = -1;
    for (let offset = 1; offset <= bins; offset++) {
      const index = (firstBreak + offset) % bins;
      if (supported[index] && runStart < 0) runStart = offset;
      const runEnds = runStart >= 0 && (!supported[index] || offset === bins);
      if (!runEnds) continue;
      const runEnd = supported[index] && offset === bins ? offset + 1 : offset;
      const span = runEnd - runStart;
      if (span >= 4) {
        const start = (firstBreak + runStart) / bins * TAU;
        const end = (firstBreak + runEnd) / bins * TAU;
        const normalizedStart = normaliseAngle(start);
        const normalizedEnd = normaliseAngle(end);
        if (normalizedStart < normalizedEnd) intervals.push({ start: normalizedStart, end: normalizedEnd });
        else {
          intervals.push({ start: normalizedStart, end: TAU });
          if (normalizedEnd > 1e-6) intervals.push({ start: 0, end: normalizedEnd });
        }
      }
      runStart = -1;
    }
    return intervals;
  };
  const pointToSegmentDistance = (point: RoboflowPoint, wall: RoboflowWallCenterline) => {
    const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 1e-8
      ? clamp(((point.x - wall.p1.x) * dx + (point.y - wall.p1.y) * dy) / lengthSquared, 0, 1)
      : 0;
    return distance(point, { x: wall.p1.x + dx * t, y: wall.p1.y + dy * t });
  };
  // Circle normalisation moves the raw medial shell onto one robust radius.
  // Preserve every junction Roboflow actually detected by moving a straight
  // endpoint with that same shell. This is evidence-gated: an endpoint must
  // already touch a raw curved segment within wall-thickness tolerance, so a
  // genuine door/window gap is never closed merely because it is near the
  // circle.
  const isShortTangentialShellFragment = (wall: RoboflowWallCenterline) => {
    if (wall.geometryKind !== 'straight') return false;
    const wallLength = distance(wall.p1, wall.p2);
    if (wallLength >= Math.max(circle.radius * .12, wall.thicknessPixels * 3)) return false;
    const midpoint = { x: (wall.p1.x + wall.p2.x) / 2, y: (wall.p1.y + wall.p2.y) / 2 };
    const midpointRadius = distance(midpoint, circle.center);
    if (!(midpointRadius > 1e-6) || Math.abs(midpointRadius - circle.radius) / circle.radius > .11) return false;
    const unit = { x: (wall.p2.x - wall.p1.x) / wallLength, y: (wall.p2.y - wall.p1.y) / wallLength };
    const radial = { x: (midpoint.x - circle.center.x) / midpointRadius, y: (midpoint.y - circle.center.y) / midpointRadius };
    return Math.abs(unit.x * -radial.y + unit.y * radial.x) >= .85;
  };
  const retained = walls.filter(wall => !circular.includes(wall) && !isShortTangentialShellFragment(wall)).map(wall => {
    const copy = { ...wall, p1: { ...wall.p1 }, p2: { ...wall.p2 } };
    if (copy.geometryKind !== 'straight') return copy;
    const copyLength = distance(copy.p1, copy.p2);
    const copyMidpoint = { x: (copy.p1.x + copy.p2.x) / 2, y: (copy.p1.y + copy.p2.y) / 2 };
    const copyMidpointRadius = distance(copyMidpoint, circle.center);
    const copyRadii = [distance(copy.p1, circle.center), distance(copy.p2, circle.center)];
    const copyUnit = copyLength > 1e-6
      ? { x: (copy.p2.x - copy.p1.x) / copyLength, y: (copy.p2.y - copy.p1.y) / copyLength }
      : { x: 0, y: 0 };
    const copyRadial = copyMidpointRadius > 1e-6
      ? { x: (copyMidpoint.x - circle.center.x) / copyMidpointRadius, y: (copyMidpoint.y - circle.center.y) / copyMidpointRadius }
      : { x: 0, y: 0 };
    const isStraightShellRun = copyLength >= Math.max(12, copy.thicknessPixels * 1.4, circle.radius * .16)
      && copyRadii.every(radius => Math.abs(radius - circle.radius) / circle.radius <= .1)
      && Math.abs(copyUnit.x * -copyRadial.y + copyUnit.y * copyRadial.x) >= .7;
    // This is an explicit non-curved exterior run, not an interior wall ending
    // at the shell. Projecting both ends radially would turn the straight line
    // into a diagonal pseudo-chord, so preserve its detected endpoints exactly.
    if (isStraightShellRun) return copy;
    (['p1', 'p2'] as const).forEach(endpoint => {
      const point = copy[endpoint];
      const shellDistance = Math.min(...circular.map(segment => pointToSegmentDistance(point, segment)));
      const typicalThickness = Math.max(
        copy.thicknessPixels,
        median(circular.map(segment => segment.thicknessPixels).filter(value => Number.isFinite(value) && value > 0)),
      );
      if (shellDistance > Math.max(3, typicalThickness * 1.65)) return;
      const radius = distance(point, circle.center);
      if (!(radius > 1e-6)) return;
      const projected = {
        x: circle.center.x + (point.x - circle.center.x) / radius * circle.radius,
        y: circle.center.y + (point.y - circle.center.y) / radius * circle.radius,
      };
      if (distance(point, projected) > Math.max(4, typicalThickness * 2.25)) return;
      copy[endpoint] = projected;
    });
    return copy;
  });
  // Polygon contours recover true shell pieces which thinning can fragment,
  // but contour proximity alone cannot distinguish an arc from a nearby
  // straight tangent. Explicit straight shell paths therefore carve their
  // angular spans back out of polygon-derived arc evidence.
  const straightShellExclusions: AngularInterval[] = walls.flatMap(wall => {
    if (wall.geometryKind !== 'straight') return [];
    const wallLength = distance(wall.p1, wall.p2);
    if (wallLength < Math.max(12, wall.thicknessPixels * 1.4, circle.radius * .16)) return [];
    const radii = [distance(wall.p1, circle.center), distance(wall.p2, circle.center)];
    if (radii.some(radius => Math.abs(radius - circle.radius) / circle.radius > .1)) return [];
    const midpoint = { x: (wall.p1.x + wall.p2.x) / 2, y: (wall.p1.y + wall.p2.y) / 2 };
    const midpointRadius = distance(midpoint, circle.center);
    if (!(midpointRadius > 1e-6)) return [];
    const unit = { x: (wall.p2.x - wall.p1.x) / wallLength, y: (wall.p2.y - wall.p1.y) / wallLength };
    const radial = { x: (midpoint.x - circle.center.x) / midpointRadius, y: (midpoint.y - circle.center.y) / midpointRadius };
    if (Math.abs(unit.x * -radial.y + unit.y * radial.x) < .7) return [];
    let first = normaliseAngle(Math.atan2(wall.p1.y - circle.center.y, wall.p1.x - circle.center.x));
    let second = normaliseAngle(Math.atan2(wall.p2.y - circle.center.y, wall.p2.x - circle.center.x));
    let delta = (second - first + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (delta < 0) {
      [first, second] = [second, first];
      delta = -delta;
    }
    if (delta <= 1e-5 || delta > Math.PI / 2) return [];
    const padding = Math.max(Math.PI / 180, wall.thicknessPixels / circle.radius * .55);
    const start = normaliseAngle(first - padding), end = first + delta + padding;
    if (start <= end && end <= Math.PI * 2) return [{ start, end }];
    if (end > Math.PI * 2) return [{ start, end: Math.PI * 2 }, { start: 0, end: end - Math.PI * 2 }];
    return [{ start, end: Math.PI * 2 }, { start: 0, end: normaliseAngle(end) }];
  });
  const subtractInterval = (source: AngularInterval, cut: AngularInterval): AngularInterval[] => {
    if (cut.end <= source.start || cut.start >= source.end) return [source];
    const result: AngularInterval[] = [];
    if (cut.start > source.start) result.push({ start: source.start, end: Math.min(source.end, cut.start) });
    if (cut.end < source.end) result.push({ start: Math.max(source.start, cut.end), end: source.end });
    return result;
  };
  let intervals: AngularInterval[] = [...circularPolygonIntervals(polygons, circle), ...rasterIntervals()];
  straightShellExclusions.forEach(cut => {
    intervals = intervals.flatMap(interval => subtractInterval(interval, cut));
  });
  circular.forEach(wall => {
    let start = normaliseAngle(Math.atan2(wall.p1.y - circle.center.y, wall.p1.x - circle.center.x));
    let end = normaliseAngle(Math.atan2(wall.p2.y - circle.center.y, wall.p2.x - circle.center.x));
    let delta = (end - start + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (delta < 0) {
      [start, end] = [end, start];
      delta = -delta;
    }
    if (delta <= 1e-5 || delta > Math.PI / 2) return;
    end = start + delta;
    if (end <= Math.PI * 2) intervals.push({ start, end });
    else {
      intervals.push({ start, end: Math.PI * 2 });
      intervals.push({ start: 0, end: end - Math.PI * 2 });
    }
  });
  if (!intervals.length) return walls;
  intervals.sort((a, b) => a.start - b.start);
  const mergeGap = Math.PI * 3.5 / 180;
  const merged: AngularInterval[] = [];
  intervals.forEach(interval => {
    const previous = merged[merged.length - 1];
    if (previous && interval.start - previous.end <= mergeGap) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  });
  if (merged.length > 1) {
    const first = merged[0], last = merged[merged.length - 1];
    const wrapGap = first.start + Math.PI * 2 - last.end;
    if (wrapGap <= mergeGap) {
      merged.splice(merged.length - 1, 1);
      merged.splice(0, 1);
      merged.push({ start: last.start, end: first.end + Math.PI * 2 });
    }
  }

  const targetAngle = clamp(
    Math.max(Math.PI * 6 / 180, typicalThickness * 1.8 / circle.radius),
    Math.PI * 6 / 180,
    Math.PI * 12 / 180,
  );
  const confidence = median(circular.map(wall => wall.confidence)) || .8;
  const normalized: RoboflowWallCenterline[] = [];
  merged.sort((a, b) => a.start - b.start).forEach(interval => {
    const span = interval.end - interval.start;
    // Isolated sub-chord islands are skeleton noise, not usable wall runs.
    if (span < targetAngle * .72) return;
    const steps = Math.max(1, Math.ceil(span / targetAngle));
    let previous = {
      x: circle.center.x + Math.cos(interval.start) * circle.radius,
      y: circle.center.y + Math.sin(interval.start) * circle.radius,
    };
    for (let step = 1; step <= steps; step++) {
      const angle = interval.start + span * step / steps;
      const next = {
        x: circle.center.x + Math.cos(angle) * circle.radius,
        y: circle.center.y + Math.sin(angle) * circle.radius,
      };
      normalized.push({
        id: `roboflow-circle-chord-${normalized.length + 1}`,
        p1: previous,
        p2: next,
        confidence,
        thicknessPixels: typicalThickness,
        polygonIndex: -1,
        geometryKind: 'curved-chord',
      });
      previous = next;
    }
  });
  // Join a verified long straight exterior run back to the two neighboring
  // normalized arc ends. Only small endpoint movements are allowed and the
  // straight wall itself remains untouched.
  const straightShellRuns = retained.filter(wall => {
    if (wall.geometryKind !== 'straight') return false;
    const wallLength = distance(wall.p1, wall.p2);
    if (wallLength < Math.max(12, wall.thicknessPixels * 1.4, circle.radius * .16)) return false;
    const radii = [distance(wall.p1, circle.center), distance(wall.p2, circle.center)];
    return radii.every(radius => Math.abs(radius - circle.radius) / circle.radius <= .1);
  });
  const usedNormalizedEndpoints = new Set<string>();
  straightShellRuns.forEach(run => {
    (['p1', 'p2'] as const).forEach(runEndpoint => {
      const target = run[runEndpoint];
      let best: { wall: RoboflowWallCenterline; endpoint: 'p1' | 'p2'; gap: number; key: string } | undefined;
      normalized.forEach((wall, wallIndex) => {
        (['p1', 'p2'] as const).forEach(endpoint => {
          const key = `${wallIndex}:${endpoint}`;
          if (usedNormalizedEndpoints.has(key)) return;
          const gap = distance(target, wall[endpoint]);
          if (!best || gap < best.gap) best = { wall, endpoint, gap, key };
        });
      });
      const tolerance = Math.max(run.thicknessPixels * 2.1, circle.radius * .085);
      if (best && best.gap <= tolerance) {
        best.wall[best.endpoint] = { ...target };
        usedNormalizedEndpoints.add(best.key);
      }
    });
  });
  return [...retained, ...normalized];
};

/** Converts only wall polygons to source-image pixel-space line segments. */
export const convertRoboflowWallsToCenterlines = (polygons: RoboflowWallPolygon[], options: RoboflowWallConnectorOptions = {}): RoboflowWallCenterline[] => {
  const output: RoboflowWallCenterline[] = [];
  const circularBoundary = inferCircularBoundary(polygons);
  const circularBoundaries = circularBoundary
    ? [circularBoundary, ...inferNestedCircularBoundaries(polygons, circularBoundary)]
    : [];
  polygons.forEach((polygon, polygonIndex) => {
    const polygonOutputStart = output.length;
    const blob = impliedThickness(polygon.points) > (options.maxWallThicknessPixels ?? Infinity);
    if (blob && !options.isWallPixel) return;
    let raster = rasterize(polygon.points, blob ? options.isWallPixel : undefined);
    // Source rasterisation may miss pale scanned ink. Retain the annotated
    // Roboflow polygon rather than silently losing an entire wall network.
    if (blob && raster && raster.filled < 200) raster = rasterize(polygon.points);
    if (blob && raster) raster = dropThinStrokes(raster) ?? raster;
    if (!raster) return;
    const transform = distanceTransform(raster), skeleton = thin(raster);
    const medial = [...skeleton.keys()].filter(index => skeleton[index]).map(index => transform[index]);
    const localThickness = Math.max(1, median(medial) * 2);
    // Junction skeletons contain pixel-scale spokes whose length is comparable
    // to the wall thickness. They render as the small floating rectangles seen
    // in the Hybrid JSON even though Roboflow's mask is clean. A genuine wall
    // run is longer than its own width, so prune those medial-axis artifacts
    // before simplification instead of rewarding a higher segment count.
    // Circular instance masks commonly join short room-divider returns into a
    // much longer outer shell. Their genuine internal branches can be only one
    // wall-width long, so the generic 1.35x junction pruning discards geometry
    // that Roboflow visibly segmented. Keep the strict threshold everywhere
    // else; the circular route is already gated by inferCircularBoundary.
    const straightMinLength = circularBoundary
      ? Math.max(2, localThickness * .72)
      : Math.max(3, localThickness * 1.35);
    const curvedMinLength = Math.max(2, localThickness * .5);
    const convertPaths = (
      paths: ReturnType<typeof tracePaths>,
      angularRecovery = false,
    ): RoboflowWallCenterline[] => {
      const converted: RoboflowWallCenterline[] = [];
      for (const path of paths) {
        const pathCircle = !angularRecovery
          ? pathFollowsCircularBoundary(path.points, raster, circularBoundaries)
          : undefined;
        const curved = !!pathCircle;
        const minLength = curved ? curvedMinLength : straightMinLength;
        const pathLength = path.points.reduce((sum, point, index) => index ? sum + distance(point, path.points[index - 1]) : 0, 0);
        const junctionAndFree = (path.firstDegree >= 3 || path.lastDegree >= 3) && (path.firstDegree === 1 || path.lastDegree === 1);
        // Only straight paths use the strict junction-spoke rejection. Short
        // arc pieces are expected where circular masks meet apertures.
        const junctionSpokeLength = localThickness * (circularBoundary ? .62 : 1.1);
        if ((!curved && junctionAndFree && pathLength < junctionSpokeLength) || pathLength < minLength) continue;
        const points = [...path.points];
        const anchorDistance = Math.min(8, points.length - 1);
        const freeEndExtension = Math.ceil(localThickness * (angularRecovery ? 1.8 : 1));
        if (path.firstDegree === 1 && anchorDistance) points[0] = extendFreeEnd(points[0], points[anchorDistance], raster, freeEndExtension);
        if (path.lastDegree === 1 && anchorDistance) {
          const last = points.length - 1;
          points[last] = extendFreeEnd(points[last], points[last - anchorDistance], raster, freeEndExtension);
        }
        const simplifyTolerance = curved ? Math.max(.65, localThickness * .12) : Math.max(1.2, localThickness * .25);
        const mergeLength = curved ? Math.max(2, localThickness * .35) : minLength;
        const simplified = mergeShortSegments(simplify(points, simplifyTolerance), mergeLength);
        const simplifiedLength = simplified.reduce((sum, point, index) => index ? sum + distance(point, simplified[index - 1]) : sum, 0);
        if (simplifiedLength < minLength) continue;
        for (let index = 1; index < simplified.length; index++) {
          const localSegmentLength = distance(simplified[index - 1], simplified[index]);
          let segmentCurved = curved;
          if (segmentCurved && pathCircle) {
            const localRadius = pathCircle.radius * raster.scale;
            // If this exact straight segment were a chord of the inferred
            // circle, its arc would bow away by `sagitta`. A sagitta materially
            // larger than the simplifier tolerance could not have collapsed
            // from a real curved path into one line; it is a genuine straight
            // tangent/chamfer embedded between arc portions.
            const halfChord = Math.min(localRadius, localSegmentLength / 2);
            const sagitta = localRadius - Math.sqrt(Math.max(0, localRadius * localRadius - halfChord * halfChord));
            if (sagitta > simplifyTolerance * 1.35) segmentCurved = false;
          }
          const p1 = { x: simplified[index - 1].x / raster.scale + raster.offsetX, y: simplified[index - 1].y / raster.scale + raster.offsetY };
          const p2 = { x: simplified[index].x / raster.scale + raster.offsetX, y: simplified[index].y / raster.scale + raster.offsetY };
          if (distance(p1, p2) < 1e-6) continue;
          converted.push({
            id: `roboflow-wall-${polygonIndex + 1}-${converted.length + 1}`,
            p1,
            p2,
            confidence: polygon.confidence,
            thicknessPixels: localThickness / raster.scale,
            polygonIndex,
            geometryKind: segmentCurved ? 'curved-chord' : 'straight',
          });
        }
      }
      return converted;
    };

    const ordinaryWalls = convertPaths(tracePaths(skeleton, raster.width, raster.height));
    let selectedWalls = ordinaryWalls;
    if (!circularBoundary && polygon.confidence >= .9 && polygon.points.length >= 150) {
      let perimeter = 0;
      for (let index = 0; index < polygon.points.length; index++) {
        perimeter += distance(polygon.points[index], polygon.points[(index + 1) % polygon.points.length]);
      }
      // For a wall-band polygon the contour has two long faces, so half its
      // perimeter is a conservative expected centreline budget.
      const expectedLength = perimeter / 2;
      const ordinaryLength = ordinaryWalls.reduce((sum, wall) => sum + distance(wall.p1, wall.p2), 0);
      if (expectedLength > 80 && ordinaryLength / expectedLength < .70) {
        const angularWalls = convertPaths(
          tracePaths(skeleton, raster.width, raster.height, true),
          true,
        );
        const angularLength = angularWalls.reduce((sum, wall) => sum + distance(wall.p1, wall.p2), 0);
        const containsRealAngle = angularWalls.some(wall => {
          const angle = Math.abs(Math.atan2(wall.p2.y - wall.p1.y, wall.p2.x - wall.p1.x) * 180 / Math.PI) % 90;
          return Math.min(angle, 90 - angle) >= 8;
        });
        // Activate only when removing diagonal pixel triangles materially
        // restores the original mask. Orthogonal and curved routes retain
        // their established output.
        if (containsRealAngle
          && angularLength >= expectedLength * .55
          && angularLength >= Math.max(ordinaryLength * 1.5, ordinaryLength + 40)) {
          selectedWalls = angularWalls;
        }
      }
    }
    selectedWalls.forEach(wall => {
      if (output.length >= 4000) return;
      output.push({ ...wall, id: `roboflow-wall-${polygonIndex + 1}-${output.length + 1}` });
    });
    // Do not let a collapsed joined diagonal network disappear merely because
    // the generic medial-axis pruning only retained a tiny branch. Circular
    // masks continue through their own topology path unchanged.
    if (!circularBoundary) {
      const emitted = output.slice(polygonOutputStart);
      const fallback = recoverCollapsedAngledWall(polygon, emitted, polygonIndex)
        ?? recoverCollapsedSimpleWall(polygon, emitted, polygonIndex);
      if (fallback) {
        output.splice(polygonOutputStart, emitted.length, fallback);
      }
    }
  });
  // Circular plans have a separate arc/chord topology pass. Keep it isolated:
  // straight normalization is only for plans with no inferred circular shell.
  const normalized = circularBoundary ? output : normalizeStraightWallNetwork(output);
  bridgeCircularWallGaps(normalized, polygons, options.isWallPixel);
  return circularBoundaries.reduce(
    (walls, circle) => normalizeCircularChords(walls, circle, polygons, options.isWallPixel),
    normalized,
  );
};

/** Compatibility name for diagnostic consumers; both functions are identical. */
export const extractWallCenterlinesFromPolygons = convertRoboflowWallsToCenterlines;
