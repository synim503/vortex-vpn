import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Minus,
  Square,
  X,
  ShieldCheck,
  ShieldAlert,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import type { TrafficStats, VpnStatus } from "../types/vpn";
import { formatSpeed, isTauriRuntime } from "../api/tauri";

interface TitleBarProps {
  status: VpnStatus | null;
  traffic: TrafficStats;
  onElevate: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  status,
  traffic,
  onElevate,
}) => {
  const win = isTauriRuntime() ? getCurrentWindow() : null;
  const isConnected = status?.state === "connected";
  const isConnecting = status?.state === "connecting";

  return (
    <header
      data-tauri-drag-region
      className="h-11 shrink-0 flex items-center justify-between px-3.5 bg-[#0A0E15]/95 border-b border-white/[0.06] select-none"
    >
      {/* Left: Brand & Live Pill */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div
          data-tauri-drag-region
          className="flex items-center gap-2.5 pointer-events-none"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 border border-emerald-400/30 flex items-center justify-center shadow-inner">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                  : isConnecting
                  ? "bg-amber-400 animate-pulse"
                  : "bg-slate-500"
              }`}
            />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-slate-100">
            Vortex <span className="text-emerald-400 font-medium">VPN</span>
          </span>
        </div>

        {/* Compact live speed pill in titlebar when connected */}
        {isConnected && (
          <div className="hidden sm:flex items-center gap-2.5 px-2.5 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1 text-emerald-400">
              <ArrowDown className="w-3 h-3" />
              {formatSpeed(traffic.down)}
            </span>
            <span className="text-white/15">|</span>
            <span className="flex items-center gap-1 text-cyan-400">
              <ArrowUp className="w-3 h-3" />
              {formatSpeed(traffic.up)}
            </span>
          </div>
        )}
      </div>

      {/* Right: Admin status + Window controls */}
      <div className="flex items-center gap-1.5">
        {status && (
          <button
            onClick={!status.isAdmin ? onElevate : undefined}
            title={
              status.isAdmin
                ? "Запущено с правами администратора — TUN режим готов"
                : "Нажмите для запуска от администратора (нужно для TUN)"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              status.isAdmin
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                : "bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 cursor-pointer"
            }`}
          >
            {status.isAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>TUN Ready</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Нет прав Admin</span>
              </>
            )}
          </button>
        )}

        <div className="h-4 w-px bg-white/[0.07] mx-1" />

        <button
          onClick={() => win?.minimize()}
          className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
          title="Свернуть"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => win?.toggleMaximize()}
          className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
          title="Развернуть"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => win?.close()}
          className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/80 transition-colors"
          title="Закрыть"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
