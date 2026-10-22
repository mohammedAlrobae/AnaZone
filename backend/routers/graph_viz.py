"""
Graph Visualization Router
Serves an interactive force-directed physics visualization of the LangGraph agent workflow.
Endpoint: GET /graph
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["Graph Visualization"])


GRAPH_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AnaZone — LangGraph Agent Visualization</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%; height: 100%; overflow: hidden; background: #0a0a12;
    background-image: radial-gradient(circle at center, rgba(20,20,40,0.5) 0%, rgba(5,5,10,0.95) 75%), radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 100% 100%, 40px 40px;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  canvas:active { cursor: grabbing; }

  /* Overlay title */
  .title-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 10;
    padding: 18px 28px;
    background: linear-gradient(180deg, rgba(10,10,18,0.92) 0%, transparent 100%);
    display: flex; align-items: center; gap: 14px;
    pointer-events: none;
  }
  .title-bar h1 {
    font-size: 17px; font-weight: 600; letter-spacing: 0.4px;
    background: linear-gradient(135deg, #a78bfa, #38bdf8, #34d399);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .title-bar .badge {
    font-size: 10px; padding: 3px 10px; border-radius: 20px;
    background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.3);
    color: #c4b5fd; letter-spacing: 0.6px; text-transform: uppercase;
  }

  /* Legend */
  .legend {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10;
    display: flex; gap: 18px; padding: 10px 24px; border-radius: 14px;
    background: rgba(20,20,35,0.85); border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(12px); pointer-events: none;
  }
  .legend-item { display: flex; align-items: center; gap: 7px; font-size: 11px; color: rgba(255,255,255,0.55); }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
</style>
</head>
<body>

<div class="title-bar">
  <h1>AnaZone Agent Graph</h1>
  <span class="badge">LangGraph</span>
</div>

<canvas id="canvas"></canvas>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#a78bfa"></div>Control</div>
  <div class="legend-item"><div class="legend-dot" style="background:#38bdf8"></div>Tool Node</div>
  <div class="legend-item"><div class="legend-dot" style="background:#22d3ee"></div>Terminal</div>
  <div class="legend-item"><div class="legend-dot" style="background:rgba(255,255,255,0.25)"></div>Edge</div>
</div>

<script>
// ──────────────────────────────────────────────
// Graph Definition (mirrors build_agent_graph)
// ──────────────────────────────────────────────
const NODES = [
  { id: "__start__",         label: "START",           type: "terminal", radius: 22 },
  { id: "router",            label: "Router",          type: "control",  radius: 32 },
  { id: "weather_node",      label: "Weather\\nOpen-Meteo",  type: "tool", radius: 30 },
  { id: "news_node",         label: "News\\nNewsData.io",    type: "tool", radius: 30 },
  { id: "general_info_node", label: "General\\nInfo",        type: "tool", radius: 30 },
  { id: "__end__",           label: "END",             type: "terminal", radius: 22 },
];

const EDGES = [
  { from: "__start__", to: "router",            style: "solid" },
  { from: "router",    to: "weather_node",      style: "dashed", label: "weather" },
  { from: "router",    to: "news_node",         style: "dashed", label: "news" },
  { from: "router",    to: "general_info_node", style: "dashed", label: "general" },
  { from: "weather_node",      to: "__end__", style: "solid" },
  { from: "news_node",         to: "__end__", style: "solid" },
  { from: "general_info_node", to: "__end__", style: "solid" },
];

// ──────────────────────────────────────────────
// Color Palette
// ──────────────────────────────────────────────
const PALETTE = {
  terminal: { fill: "#22d3ee", glow: "rgba(34,211,238,0.45)",  text: "#0a0a12" },
  control:  { fill: "#a78bfa", glow: "rgba(167,139,250,0.45)", text: "#0a0a12" },
  tool:     { fill: "#38bdf8", glow: "rgba(56,189,248,0.40)",  text: "#0a0a12" },
};

// ──────────────────────────────────────────────
// Canvas Setup
// ──────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");
let W, H, dpr;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ──────────────────────────────────────────────
// Physics State
// ──────────────────────────────────────────────
const SIM_SPEED   = 0.92;   // velocity damping
const REPULSION   = 18000;  // node-node repulsion
const SPRING_K    = 0.006;  // spring constant
const SPRING_LEN  = 160;    // rest length
const CENTER_PULL = 0.0003; // pull towards canvas center

// Initialize positions in a nice layout
function initPositions() {
  const cx = W / 2, cy = H / 2;
  const spacing = Math.min(W, H) * 0.18;
  // Manual initial layout: START left, router center-left, 3 tools fanned, END right
  const positions = {
    "__start__":         { x: cx - spacing * 2.2, y: cy },
    "router":            { x: cx - spacing * 0.7, y: cy },
    "weather_node":      { x: cx + spacing * 0.8, y: cy - spacing * 1.1 },
    "news_node":         { x: cx + spacing * 0.8, y: cy },
    "general_info_node": { x: cx + spacing * 0.8, y: cy + spacing * 1.1 },
    "__end__":           { x: cx + spacing * 2.2, y: cy },
  };
  NODES.forEach(n => {
    const p = positions[n.id] || { x: cx + (Math.random()-0.5)*200, y: cy + (Math.random()-0.5)*200 };
    n.x  = p.x;  n.y  = p.y;
    n.vx = 0;    n.vy = 0;
    n.fx = 0;    n.fy = 0;
  });
}
initPositions();

// Build adjacency lookup for edges
const nodeById = {};
NODES.forEach(n => nodeById[n.id] = n);

// ──────────────────────────────────────────────
// Physics Simulation Tick
// ──────────────────────────────────────────────
function physicsTick() {
  // Reset forces
  NODES.forEach(n => { n.fx = 0; n.fy = 0; });

  // Repulsion (all pairs)
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i], b = NODES[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx*dx + dy*dy) || 1;
      let force = REPULSION / (dist * dist);
      let fx = (dx / dist) * force;
      let fy = (dy / dist) * force;
      a.fx -= fx; a.fy -= fy;
      b.fx += fx; b.fy += fy;
    }
  }

  // Spring attraction (edges)
  EDGES.forEach(e => {
    const a = nodeById[e.from], b = nodeById[e.to];
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    let dist = Math.sqrt(dx*dx + dy*dy) || 1;
    let displacement = dist - SPRING_LEN;
    let force = SPRING_K * displacement;
    let fx = (dx / dist) * force;
    let fy = (dy / dist) * force;
    a.fx += fx; a.fy += fy;
    b.fx -= fx; b.fy -= fy;
  });

  // Center pull
  const cx = W / 2, cy = H / 2;
  NODES.forEach(n => {
    n.fx += (cx - n.x) * CENTER_PULL;
    n.fy += (cy - n.y) * CENTER_PULL;
  });

  // Integrate
  NODES.forEach(n => {
    if (n._dragging) return;
    n.vx = (n.vx + n.fx) * SIM_SPEED;
    n.vy = (n.vy + n.fy) * SIM_SPEED;
    n.x += n.vx;
    n.y += n.vy;
    // Boundary clamp
    n.x = Math.max(n.radius + 10, Math.min(W - n.radius - 10, n.x));
    n.y = Math.max(n.radius + 10, Math.min(H - n.radius - 10, n.y));
  });
}

// ──────────────────────────────────────────────
// Drawing
// ──────────────────────────────────────────────
let time = 0;

function drawEdge(e) {
  const a = nodeById[e.from], b = nodeById[e.to];
  if (!a || !b) return;

  ctx.save();
  // Gradient along edge
  const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  const colA = PALETTE[a.type] || PALETTE.tool;
  const colB = PALETTE[b.type] || PALETTE.tool;
  grad.addColorStop(0, colA.glow);
  grad.addColorStop(1, colB.glow);

  ctx.strokeStyle = grad;
  ctx.lineWidth   = 1.8;

  if (e.style === "dashed") {
    ctx.setLineDash([7, 5]);
  }

  // Draw line
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const arrowLen = 10;
  const targetR  = (b.radius || 24) + 6;
  const ax2 = b.x - Math.cos(angle) * targetR;
  const ay2 = b.y - Math.sin(angle) * targetR;

  ctx.fillStyle = colB.glow;
  ctx.beginPath();
  ctx.moveTo(ax2, ay2);
  ctx.lineTo(ax2 - arrowLen * Math.cos(angle - 0.35), ay2 - arrowLen * Math.sin(angle - 0.35));
  ctx.lineTo(ax2 - arrowLen * Math.cos(angle + 0.35), ay2 - arrowLen * Math.sin(angle + 0.35));
  ctx.closePath();
  ctx.fill();

  // Edge label
  if (e.label) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.font      = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    ctx.fillText(e.label, mx, my - 8);
  }

  ctx.restore();
}

function drawNode(n) {
  const pal   = PALETTE[n.type] || PALETTE.tool;
  const r     = n.radius;
  const pulse = 1 + Math.sin(time * 2 + NODES.indexOf(n)) * 0.02;  // subtle breath

  ctx.save();

  // Outer glow (two layers)
  const glowR = r * 2.2 * pulse;
  const glow1 = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glowR);
  glow1.addColorStop(0, pal.glow);
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.beginPath();
  ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Main sphere gradient (3D illusion)
  const sphereGrad = ctx.createRadialGradient(
    n.x - r * 0.3, n.y - r * 0.35, r * 0.1,
    n.x, n.y, r
  );
  sphereGrad.addColorStop(0, "#ffffff");
  sphereGrad.addColorStop(0.25, pal.fill);
  sphereGrad.addColorStop(1, shadeColor(pal.fill, -50));

  ctx.fillStyle = sphereGrad;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight (top-left)
  const specGrad = ctx.createRadialGradient(
    n.x - r * 0.28, n.y - r * 0.28, 0,
    n.x - r * 0.2, n.y - r * 0.2, r * 0.55
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  specGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  const lines = n.label.split("\\n");
  if (lines.length === 1) {
    ctx.font      = `bold ${n.type === "terminal" ? 11 : 12}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = pal.text;
    ctx.fillText(lines[0], n.x, n.y);
  } else {
    ctx.font      = `bold 11px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = pal.text;
    ctx.fillText(lines[0], n.x, n.y - 7);
    ctx.font      = `9px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(lines[1], n.x, n.y + 8);
  }

  ctx.restore();
}

function shadeColor(hex, amount) {
  let r = parseInt(hex.slice(1,3), 16) + amount;
  let g = parseInt(hex.slice(3,5), 16) + amount;
  let b = parseInt(hex.slice(5,7), 16) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// Background grid
function drawBackground() {
  // Subtle radial vignette
  const vigGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
  vigGrad.addColorStop(0, "rgba(20,20,40,0)");
  vigGrad.addColorStop(1, "rgba(5,5,10,0.6)");

  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  const gridSize = 40;
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let gx = gridSize; gx < W; gx += gridSize) {
    for (let gy = gridSize; gy < H; gy += gridSize) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);
}

// ──────────────────────────────────────────────
// Animation Loop
// ──────────────────────────────────────────────
function frame(ts) {
  time = ts / 1000;
  physicsTick();
  drawBackground();
  EDGES.forEach(drawEdge);
  NODES.forEach(drawNode);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ──────────────────────────────────────────────
// Drag Interaction
// ──────────────────────────────────────────────
let dragNode = null;
let dragOffX = 0, dragOffY = 0;

function getNodeAt(mx, my) {
  // Reverse order so topmost node wins
  for (let i = NODES.length - 1; i >= 0; i--) {
    const n = NODES[i];
    const dx = mx - n.x, dy = my - n.y;
    if (dx*dx + dy*dy <= (n.radius + 8) * (n.radius + 8)) return n;
  }
  return null;
}

canvas.addEventListener("pointerdown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const node = getNodeAt(mx, my);
  if (node) {
    dragNode = node;
    dragNode._dragging = true;
    dragNode.vx = 0;
    dragNode.vy = 0;
    dragOffX = mx - node.x;
    dragOffY = my - node.y;
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointermove", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Cursor feedback
  canvas.style.cursor = getNodeAt(mx, my) ? "grab" : "default";

  if (dragNode) {
    dragNode.x = mx - dragOffX;
    dragNode.y = my - dragOffY;
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("pointerup", () => {
  if (dragNode) {
    dragNode._dragging = false;
    dragNode = null;
  }
});

// Re-layout on resize
window.addEventListener("resize", () => {
  resize();
  // Don't reset positions, just let physics re-settle
});
</script>
</body>
</html>
"""


@router.get("/graph", response_class=HTMLResponse)
def visualize_graph():
    """
    Serves an interactive, force-directed physics visualization
    of the LangGraph agent workflow as draggable 3D sphere nodes.
    """
    return HTMLResponse(content=GRAPH_HTML)
