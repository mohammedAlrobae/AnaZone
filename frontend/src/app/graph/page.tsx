"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Play, Pause } from "lucide-react";

interface NodeItem {
  id: string;
  label: string;
  subtitle?: string;
  type: "terminal" | "control" | "tool";
  radius: number;
  color: string;
  glow: string;
  description: string;
  details: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  _dragging?: boolean;
}

interface EdgeItem {
  from: string;
  to: string;
  style: "solid" | "dashed";
  label?: string;
}

const INITIAL_NODES: Omit<NodeItem, "x" | "y" | "vx" | "vy" | "fx" | "fy">[] = [
  {
    id: "__start__",
    label: "START",
    type: "terminal",
    radius: 26,
    color: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.4)",
    description: "Workflow Entry Point",
    details: ["Receives user message & active place context", "Initializes AgentState with conversation history"],
  },
  {
    id: "router",
    label: "Router",
    subtitle: "Intent Classifier",
    type: "control",
    radius: 36,
    color: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.4)",
    description: "Smart Intent Routing",
    details: ["Analyzes user intent with LLM", "Routes conditionally to weather, news, or general info"],
  },
  {
    id: "weather_node",
    label: "Weather",
    subtitle: "Open-Meteo API",
    type: "tool",
    radius: 33,
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.4)",
    description: "Live Weather Tool",
    details: ["Coordinates lookup for selected place", "Fetches temperature (°C), conditions, humidity & wind", "Generates natural speech response with exact digits"],
  },
  {
    id: "news_node",
    label: "News",
    subtitle: "NewsData.io API",
    type: "tool",
    radius: 33,
    color: "#34d399",
    glow: "rgba(52, 211, 153, 0.4)",
    description: "Live News Tool",
    details: ["Detects country code & city query", "Queries NewsData.io latest API", "Synthesizes recent headlines & summaries for the place"],
  },
  {
    id: "general_info_node",
    label: "General Info",
    subtitle: "LLM Knowledge",
    type: "tool",
    radius: 33,
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.4)",
    description: "Place Exploration",
    details: ["Explores history, landmarks, and culture", "Answers freeform questions about the location", "Adapts tone and language to user dialect"],
  },
  {
    id: "__end__",
    label: "END",
    type: "terminal",
    radius: 26,
    color: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
    description: "Workflow Exit",
    details: ["Assembles finalized agent response", "Streams voice synthesis audio and text to chat UI"],
  },
];

const EDGES: EdgeItem[] = [
  { from: "__start__", to: "router", style: "solid" },
  { from: "router", to: "weather_node", style: "dashed", label: "weather" },
  { from: "router", to: "news_node", style: "dashed", label: "news" },
  { from: "router", to: "general_info_node", style: "dashed", label: "general" },
  { from: "weather_node", to: "__end__", style: "solid" },
  { from: "news_node", to: "__end__", style: "solid" },
  { from: "general_info_node", to: "__end__", style: "solid" },
];

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return `rgb(${Math.min(255, Math.max(0, R))}, ${Math.min(255, Math.max(0, G))}, ${Math.min(255, Math.max(0, B))})`;
}

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeItem | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const nodesRef = useRef<NodeItem[]>([]);
  const isPausedRef = useRef(false);
  const hoveredNodeRef = useRef<NodeItem | null>(null);
  const selectedNodeRef = useRef<NodeItem | null>(null);

  isPausedRef.current = isPaused;
  selectedNodeRef.current = selectedNode;

  const resetNodePositions = useCallback(() => {
    const canvas = canvasRef.current;
    const W = canvas ? canvas.clientWidth : 1200;
    const H = canvas ? canvas.clientHeight : 800;
    const cx = W / 2;
    const cy = H / 2;
    const spacing = Math.min(W, H) * 0.2;

    const positions: Record<string, { x: number; y: number }> = {
      __start__: { x: cx - spacing * 2.3, y: cy },
      router: { x: cx - spacing * 0.8, y: cy },
      weather_node: { x: cx + spacing * 0.8, y: cy - spacing * 1.15 },
      news_node: { x: cx + spacing * 0.8, y: cy },
      general_info_node: { x: cx + spacing * 0.8, y: cy + spacing * 1.15 },
      __end__: { x: cx + spacing * 2.3, y: cy },
    };

    nodesRef.current = INITIAL_NODES.map((init) => {
      const p = positions[init.id] || { x: cx, y: cy };
      return {
        ...init,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        fx: 0,
        fy: 0,
      };
    });
  }, []);

  useEffect(() => {
    resetNodePositions();
  }, [resetNodePositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let W = 0;
    let H = 0;
    let dpr = 1;

    const handleResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for high performance on 4k/retina
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const SIM_SPEED = 0.92;
    const REPULSION = 17000;
    const SPRING_K = 0.0055;
    const SPRING_LEN = 165;
    const CENTER_PULL = 0.0003;

    let time = 0;

    // Lightweight data flow particles along edges
    const particles = Array.from({ length: 12 }, () => ({
      edgeIndex: Math.floor(Math.random() * EDGES.length),
      t: Math.random(),
      speed: 0.0035 + Math.random() * 0.003,
    }));

    const getNodeMap = () => {
      const map: Record<string, NodeItem> = {};
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        map[nodes[i].id] = nodes[i];
      }
      return map;
    };

    const physicsTick = () => {
      if (isPausedRef.current) return;
      const nodes = nodesRef.current;
      const nodeById = getNodeMap();

      for (let i = 0; i < nodes.length; i++) {
        nodes[i].fx = 0;
        nodes[i].fy = 0;
      }

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          const force = REPULSION / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.fx -= fx;
          a.fy -= fy;
          b.fx += fx;
          b.fy += fy;
        }
      }

      // Spring edges
      for (let i = 0; i < EDGES.length; i++) {
        const e = EDGES[i];
        const a = nodeById[e.from];
        const b = nodeById[e.to];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - SPRING_LEN;
        const force = SPRING_K * displacement;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.fx += fx;
        a.fy += fy;
        b.fx -= fx;
        b.fy -= fy;
      }

      // Center gravity
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.fx += (cx - n.x) * CENTER_PULL;
        n.fy += (cy - n.y) * CENTER_PULL;
      }

      // Integration
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n._dragging) continue;
        n.vx = (n.vx + n.fx) * SIM_SPEED;
        n.vy = (n.vy + n.fy) * SIM_SPEED;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(n.radius + 20, Math.min(W - n.radius - 20, n.x));
        n.y = Math.max(n.radius + 80, Math.min(H - n.radius - 80, n.y));
      }
    };

    const drawEdge = (e: EdgeItem) => {
      const nodeById = getNodeMap();
      const a = nodeById[e.from];
      const b = nodeById[e.to];
      if (!a || !b) return;

      ctx.save();
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, a.glow);
      grad.addColorStop(1, b.glow);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;

      if (e.style === "dashed") {
        ctx.setLineDash([7, 5]);
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const arrowLen = 11;
      const targetR = b.radius + 6;
      const ax = b.x - Math.cos(angle) * targetR;
      const ay = b.y - Math.sin(angle) * targetR;

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.35), ay - arrowLen * Math.sin(angle - 0.35));
      ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.35), ay - arrowLen * Math.sin(angle + 0.35));
      ctx.closePath();
      ctx.fill();

      // Edge label
      if (e.label) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = "600 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.textAlign = "center";
        ctx.fillText(e.label, mx, my - 9);
      }

      ctx.restore();
    };

    const drawParticles = () => {
      const nodeById = getNodeMap();
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.edgeIndex = Math.floor(Math.random() * EDGES.length);
        }
        const edge = EDGES[p.edgeIndex];
        const a = nodeById[edge.from];
        const b = nodeById[edge.to];
        if (!a || !b) continue;

        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;

        // Clean, lightweight particle rendering without laggy shadowBlur
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawNode = (n: NodeItem) => {
      const r = n.radius;
      const isHovered = hoveredNodeRef.current?.id === n.id;
      const isSelected = selectedNodeRef.current?.id === n.id;
      const pulse = 1 + Math.sin(time * 2.2 + nodesRef.current.indexOf(n)) * 0.025;
      const scale = isHovered || isSelected ? 1.12 : 1;
      const finalR = r * pulse * scale;

      ctx.save();

      // Outer aura
      const glowR = finalR * 2.2;
      const glowGrad = ctx.createRadialGradient(n.x, n.y, finalR * 0.3, n.x, n.y, glowR);
      glowGrad.addColorStop(0, n.glow);
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Sphere 3D gradient
      const sphereGrad = ctx.createRadialGradient(
        n.x - finalR * 0.35,
        n.y - finalR * 0.4,
        finalR * 0.08,
        n.x,
        n.y,
        finalR
      );
      sphereGrad.addColorStop(0, "#ffffff");
      sphereGrad.addColorStop(0.28, n.color);
      sphereGrad.addColorStop(1, shadeColor(n.color, -55));

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, finalR, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine
      const specGrad = ctx.createRadialGradient(
        n.x - finalR * 0.3,
        n.y - finalR * 0.3,
        0,
        n.x - finalR * 0.2,
        n.y - finalR * 0.2,
        finalR * 0.6
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, finalR, 0, Math.PI * 2);
      ctx.fill();

      // Selection ring
      if (isSelected || isHovered) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, finalR + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Labels
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (!n.subtitle) {
        ctx.font = `700 ${n.type === "terminal" ? 11 : 12}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "#09090f";
        ctx.fillText(n.label, n.x, n.y);
      } else {
        ctx.font = `700 11px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "#09090f";
        ctx.fillText(n.label, n.x, n.y - 7);
        ctx.font = `600 8.5px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "rgba(9, 9, 15, 0.75)";
        ctx.fillText(n.subtitle, n.x, n.y + 8);
      }

      ctx.restore();
    };

    const render = (ts: number) => {
      time = ts / 1000;
      physicsTick();

      // High-performance canvas clear: background is rendered via GPU CSS!
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < EDGES.length; i++) {
        drawEdge(EDGES[i]);
      }
      drawParticles();
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        drawNode(nodes[i]);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Optimized Drag & Hover Interaction Handling
    let dragNode: NodeItem | null = null;
    let dragOffX = 0;
    let dragOffY = 0;

    const getNodeAt = (mx: number, my: number): NodeItem | null => {
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = mx - n.x;
        const dy = my - n.y;
        if (dx * dx + dy * dy <= (n.radius + 10) * (n.radius + 10)) {
          return n;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
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
        setSelectedNode(node);
      } else {
        setSelectedNode(null);
      }
    };

    let lastHoveredId: string | null = null;
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hovered = getNodeAt(mx, my);
      hoveredNodeRef.current = hovered;

      // Only trigger React re-render when hover target actually changes!
      const currentId = hovered ? hovered.id : null;
      if (currentId !== lastHoveredId) {
        lastHoveredId = currentId;
        setHoveredNode(hovered);
      }

      canvas.style.cursor = hovered ? "grab" : "default";

      if (dragNode) {
        dragNode.x = mx - dragOffX;
        dragNode.y = my - dragOffY;
        canvas.style.cursor = "grabbing";
      }
    };

    const onPointerUp = () => {
      if (dragNode) {
        dragNode._dragging = false;
        dragNode = null;
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#09090f] text-white select-none"
      style={{
        backgroundImage: `
          radial-gradient(circle at center, rgba(24, 24, 45, 0.45) 0%, rgba(9, 9, 15, 0.95) 75%),
          radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 36px 36px",
      }}
    >
      {/* Top Navbar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#09090f]/90 via-[#09090f]/60 to-transparent backdrop-blur-sm pointer-events-auto">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/90 hover:text-white transition-all text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to AnaZone</span>
          </Link>

          <div className="h-4 w-px bg-white/20" />

          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold tracking-tight bg-gradient-to-r from-purple-400 via-sky-400 to-teal-400 bg-clip-text text-transparent">
              AnaZone Agent Workflow
            </h1>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
              LangGraph StateGraph
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white/85 hover:text-white transition-all cursor-pointer"
            title={isPaused ? "Resume simulation" : "Pause simulation"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>

          <button
            onClick={resetNodePositions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white/85 hover:text-white transition-all cursor-pointer"
            title="Reset positions"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Physics</span>
          </button>
        </div>
      </header>

      {/* Physics Canvas (Clear, Hardware Accelerated) */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Floating Info Card (Shows details when a node is selected or hovered) */}
      {(selectedNode || hoveredNode) && (
        <div className="absolute top-20 right-6 z-20 w-80 p-4 rounded-2xl bg-[#141424]/90 border border-white/15 backdrop-blur-xl shadow-2xl transition-all duration-200 pointer-events-none">
          {(() => {
            const active = selectedNode || hoveredNode!;
            return (
              <>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-md"
                      style={{ backgroundColor: active.color, boxShadow: `0 0 10px ${active.color}` }}
                    />
                    <h2 className="text-sm font-bold text-white">{active.label}</h2>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-white/50 tracking-wider">
                    {active.type}
                  </span>
                </div>
                <p className="text-xs text-white/70 mb-3">{active.description}</p>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                    Capabilities & State:
                  </div>
                  {active.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-white/80">
                      <span className="text-sky-400 mt-0.5">•</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}


    </div>
  );
}
