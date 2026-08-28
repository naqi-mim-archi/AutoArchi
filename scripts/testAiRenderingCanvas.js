// src/features/ai-rendering-canvas/core/GraphEngine.ts
var DEFAULT_NODE_WIDTH = 280;
var DEFAULT_NODE_HEIGHT = 320;
var DEFAULT_ACTION_NODE_HEIGHT = 160;
var GraphEngine = class {
  /**
   * Calculates the output port position on the right edge of the node.
   */
  static getOutputPortPosition(node) {
    const posX = typeof node?.position?.x === "number" && !isNaN(node.position.x) ? node.position.x : 100;
    const posY = typeof node?.position?.y === "number" && !isNaN(node.position.y) ? node.position.y : 100;
    const width = node?.width || DEFAULT_NODE_WIDTH;
    const height = node?.height || (node?.type === "action" ? DEFAULT_ACTION_NODE_HEIGHT : DEFAULT_NODE_HEIGHT);
    return {
      x: posX + width,
      y: posY + height / 2
    };
  }
  /**
   * Calculates the input port position on the left edge of the node.
   */
  static getInputPortPosition(node) {
    const posX = typeof node?.position?.x === "number" && !isNaN(node.position.x) ? node.position.x : 100;
    const posY = typeof node?.position?.y === "number" && !isNaN(node.position.y) ? node.position.y : 100;
    const height = node?.height || (node?.type === "action" ? DEFAULT_ACTION_NODE_HEIGHT : DEFAULT_NODE_HEIGHT);
    return {
      x: posX,
      y: posY + height / 2
    };
  }
  /**
   * Generates a sleek cubic Bezier SVG path between two coordinates (left-to-right flow).
   */
  static calculateBezierPath(p12, p22) {
    const x1 = typeof p12?.x === "number" && !isNaN(p12.x) ? p12.x : 0;
    const y1 = typeof p12?.y === "number" && !isNaN(p12.y) ? p12.y : 0;
    const x2 = typeof p22?.x === "number" && !isNaN(p22.x) ? p22.x : 0;
    const y2 = typeof p22?.y === "number" && !isNaN(p22.y) ? p22.y : 0;
    const dx = Math.abs(x2 - x1);
    const curvature = Math.max(dx * 0.5, 60);
    const c1x = x1 + curvature;
    const c1y = y1;
    const c2x = x2 - curvature;
    const c2y = y2;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }
  /**
   * Calculates optimal auto-layout position for a new forked/child node to avoid overlapping.
   */
  static calculateForkPosition(parentNode, existingNodes, horizontalOffset = 340, verticalSpacing = 340) {
    const parentX = typeof parentNode?.position?.x === "number" && !isNaN(parentNode.position.x) ? parentNode.position.x : 100;
    const parentY = typeof parentNode?.position?.y === "number" && !isNaN(parentNode.position.y) ? parentNode.position.y : 100;
    const targetX = parentX + horizontalOffset;
    const siblings = (existingNodes || []).filter((n) => n?.parentId === parentNode?.id);
    const siblingIndex = siblings.length;
    let targetY = parentY;
    if (siblingIndex > 0) {
      const isEven = siblingIndex % 2 === 0;
      const offsetMultiplier = Math.ceil(siblingIndex / 2);
      targetY = isEven ? parentY + offsetMultiplier * verticalSpacing : parentY - offsetMultiplier * verticalSpacing;
    }
    return { x: targetX, y: targetY };
  }
  /**
   * Converts screen pixel coordinates to canvas graph space considering pan and zoom.
   */
  static screenToGraph(screenX2, screenY2, containerRect2, viewport2) {
    const relX = screenX2 - (containerRect2?.left || 0);
    const relY = screenY2 - (containerRect2?.top || 0);
    const zoom = viewport2?.zoom || 1;
    const vx = viewport2?.x || 0;
    const vy = viewport2?.y || 0;
    return {
      x: (relX - vx) / zoom,
      y: (relY - vy) / zoom
    };
  }
  /**
   * Converts canvas graph coordinates to screen coordinates.
   */
  static graphToScreen(graphX, graphY, viewport2) {
    const zoom = viewport2?.zoom || 1;
    const vx = viewport2?.x || 0;
    const vy = viewport2?.y || 0;
    return {
      x: graphX * zoom + vx,
      y: graphY * zoom + vy
    };
  }
  /**
   * Fits all nodes cleanly within the visible viewport.
   */
  static calculateFitViewport(nodes, containerWidth, containerHeight, padding = 80) {
    if (!nodes || nodes.length === 0 || !containerWidth || !containerHeight) {
      return { x: (containerWidth || 800) / 2 - 150, y: (containerHeight || 600) / 2 - 150, zoom: 1 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const posX = typeof node?.position?.x === "number" && !isNaN(node.position.x) ? node.position.x : 100;
      const posY = typeof node?.position?.y === "number" && !isNaN(node.position.y) ? node.position.y : 100;
      const w = node?.width || DEFAULT_NODE_WIDTH;
      const h = node?.height || DEFAULT_NODE_HEIGHT;
      minX = Math.min(minX, posX);
      minY = Math.min(minY, posY);
      maxX = Math.max(maxX, posX + w);
      maxY = Math.max(maxY, posY + h);
    }
    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
      return { x: 80, y: 80, zoom: 1 };
    }
    const graphWidth = Math.max(maxX - minX + padding * 2, 100);
    const graphHeight = Math.max(maxY - minY + padding * 2, 100);
    const zoomX = containerWidth / graphWidth;
    const zoomY = containerHeight / graphHeight;
    const rawZoom = Math.min(zoomX, zoomY);
    const zoom = isNaN(rawZoom) ? 1 : Math.min(Math.max(rawZoom, 0.25), 1.5);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = containerWidth / 2 - centerX * zoom;
    const y = containerHeight / 2 - centerY * zoom;
    return {
      x: isNaN(x) ? 80 : x,
      y: isNaN(y) ? 80 : y,
      zoom: isNaN(zoom) ? 1 : zoom
    };
  }
};

// scripts/testAiRenderingCanvas.ts
var passCount = 0;
var failCount = 0;
function assert(condition, msg) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failCount++;
  }
}
console.log("=== STARTING AI RENDERING CANVAS TESTS ===\n");
var sampleNode = {
  id: "node_1",
  type: "image",
  title: "Test Node 1",
  position: { x: 100, y: 100 },
  width: 280,
  height: 320,
  status: "completed",
  createdAt: Date.now()
};
var outPort = GraphEngine.getOutputPortPosition(sampleNode);
assert(outPort.x === 380, `Output port X is 380 (got: ${outPort.x})`);
assert(outPort.y === 260, `Output port Y is 260 (got: ${outPort.y})`);
var inPort = GraphEngine.getInputPortPosition(sampleNode);
assert(inPort.x === 100, `Input port X is 100 (got: ${inPort.x})`);
assert(inPort.y === 260, `Input port Y is 260 (got: ${inPort.y})`);
var p1 = { x: 100, y: 200 };
var p2 = { x: 400, y: 350 };
var path = GraphEngine.calculateBezierPath(p1, p2);
assert(path.startsWith("M 100 200 C"), `Bezier path starts with M 100 200 C (got: ${path})`);
assert(path.endsWith("400 350"), `Bezier path ends at target coordinates (got: ${path})`);
var childNodes = [sampleNode];
var fork1 = GraphEngine.calculateForkPosition(sampleNode, childNodes);
assert(fork1.x === sampleNode.position.x + 340, `Fork 1 X offset is +340px (got: ${fork1.x})`);
assert(fork1.y === sampleNode.position.y, `Fork 1 Y is aligned with parent (got: ${fork1.y})`);
var child2 = {
  id: "node_2",
  type: "image",
  title: "Child 1",
  position: fork1,
  parentId: "node_1",
  status: "completed",
  createdAt: Date.now()
};
childNodes.push(child2);
var fork2 = GraphEngine.calculateForkPosition(sampleNode, childNodes);
assert(fork2.x === sampleNode.position.x + 340, `Fork 2 X offset is +340px (got: ${fork2.x})`);
assert(fork2.y !== sampleNode.position.y, `Fork 2 Y is staggered vertically to avoid collision (got: ${fork2.y})`);
var containerRect = {
  left: 50,
  top: 50,
  right: 1050,
  bottom: 850,
  width: 1e3,
  height: 800,
  x: 50,
  y: 50,
  toJSON: () => {
  }
};
var viewport = { x: 100, y: 100, zoom: 1.5 };
var screenX = 350;
var screenY = 400;
var graphCoord = GraphEngine.screenToGraph(screenX, screenY, containerRect, viewport);
var backToScreen = GraphEngine.graphToScreen(graphCoord.x, graphCoord.y, viewport);
assert(Math.abs(backToScreen.x + containerRect.left - screenX) < 1e-3, `Coordinate round-trip X matches`);
assert(Math.abs(backToScreen.y + containerRect.top - screenY) < 1e-3, `Coordinate round-trip Y matches`);
var nodesToFit = [
  { id: "n1", type: "image", title: "N1", position: { x: 0, y: 0 }, width: 280, height: 320, status: "completed", createdAt: Date.now() },
  { id: "n2", type: "image", title: "N2", position: { x: 600, y: 400 }, width: 280, height: 320, status: "completed", createdAt: Date.now() }
];
var fit = GraphEngine.calculateFitViewport(nodesToFit, 1200, 800);
assert(fit.zoom > 0 && fit.zoom <= 1.5, `Fit zoom is within valid range (got: ${fit.zoom})`);
console.log(`
=== ALL ${passCount} AI RENDERING CANVAS TESTS PASSED ===
`);
if (failCount > 0) {
  process.exit(1);
}
