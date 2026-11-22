import React from "react";
import { ArrowDown, ArrowUp, Copy, Check } from "lucide-react";
import type { TrafficStats } from "../types/vpn";
import { formatBytes, formatSpeed } from "../api/tauri";

interface TrafficChartProps {
  history: TrafficStats[];
  current: TrafficStats;
  mixedPort: number;
  isConnected: boolean;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  history,
  current,
  mixedPort,
  isConnected,
}) => {
  const [copied, setCopied] = React.useState(false);

  const width = 560;
  const height = 108;
  const pointsCount = 40;

  const padded = React.useMemo(() => {
    const arr = history.slice(-pointsCount);
    while (arr.length < pointsCount) {
      arr.unshift({ up: 0, down: 0, totalUp: 0, totalDown: 0, timestamp: 0 });
    }
    return arr;
  }, [history]);

  const maxVal = React.useMemo(() => {
    let m = 64 * 1024; // minimum 64 KB/s scale so idle stays calm
    for (const p of padded) {
      if (p.down > m) m = p.down;
      if (p.up > m) m = p.up;
    }
    return m * 1.15;
  }, [padded]);

  const buildPath = (key: "down" | "up", closeArea: boolean) => {
    const stepX = width / (pointsCount - 1);
    const coords = padded.map((pt, i) => {
      const x = i * stepX;
      const ratio = Math.min(1, pt[key] / maxVal);
      const y = height - ratio * (height - 14) - 4;
      return [x, y] as const;
    });

    let d = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`;
    for (let i = 1; i < coords.length; i++) {
      const [px, py] = coords[i - 1];
      const [cx, cy] = coords[i];
      const mx = ((px + cx) / 2).toFixed(1);
      d += ` Q ${px.toFixed(1)} ${py.toFixed(1)}, ${mx} ${((py + cy) / 2).toFixed(1)}`;
    }
    const last = coords[coords.length - 1];
    d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;

    if (closeArea) {
      d += ` L ${width} ${height} L 0 ${height} Z`;
    }
    return d;
  };

  const handleCopyProxy = () => {
    navigator.clipboard.writeText(`127.0.0.1:${mixedPort}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Загрузка</span>
            </div>
            <div className="text-lg font-mono font-semibold text-emerald-300 mt-0.5">
              {isConnected ? formatSpeed(current.down) : "0 B/s"}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Всего: {formatBytes(current.totalDown)}
            </div>
          </div>

          <div className="h-9 w-px bg-white/[0.06]" />

          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Отдача</span>
            </div>
            <div className="text-lg font-mono font-semibold text-cyan-300 mt-0.5">
              {isConnected ? formatSpeed(current.up) : "0 B/s"}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Всего: {formatBytes(current.totalUp)}
            </div>
          </div>
        </div>

        <button
          onClick={handleCopyProxy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Локальный SOCKS5 / HTTP прокси (работает параллельно с TUN)"
        >
          <span className="text-slate-500">SOCKS5/HTTP</span>
          <span className="text-slate-200">127.0.0.1:{mixedPort}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>

      {/* Smooth Dual Area SVG Sparkline */}
      <div className="relative h-[108px] w-full rounded-xl bg-[#0A0E15] border border-white/[0.04] overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="gradDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal grid */}
          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

          {/* Download area & line */}
          <path d={buildPath("down", true)} fill="url(#gradDown)" />
          <path
            d={buildPath("down", false)}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Upload area & line */}
          <path d={buildPath("up", true)} fill="url(#gradUp)" />
          <path
            d={buildPath("up", false)}
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.6"
            strokeDasharray="3 2"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute top-2 right-2.5 text-[10px] font-mono text-slate-500">
          пик: {formatSpeed(maxVal / 1.15)}
        </div>
      </div>
    </div>
  );
};
