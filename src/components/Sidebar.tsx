import React from "react";
import {
  Power,
  Server,
  Route,
  Activity,
  Terminal,
  Settings,
  Cpu,
} from "lucide-react";
import type { NavTab, VpnStatus } from "../types/vpn";

interface SidebarProps {
  activeTab: NavTab;
  onSelect: (tab: NavTab) => void;
  status: VpnStatus | null;
  profileCount: number;
  connectionCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Подключение", icon: Power },
  { id: "profiles", label: "Серверы", icon: Server },
  { id: "routing", label: "Маршрутизация", icon: Route },
  { id: "connections", label: "Соединения", icon: Activity },
  { id: "logs", label: "Логи", icon: Terminal },
  { id: "settings", label: "Настройки", icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelect,
  status,
  profileCount,
  connectionCount,
}) => {
  const isConnected = status?.state === "connected";
  const shortVersion = status?.coreVersion
    ? status.coreVersion.replace("sing-box version ", "v")
    : status?.coreInstalled
    ? "installed"
    : "не найдено";

  return (
    <aside className="w-[216px] shrink-0 bg-[#0B0F17] border-r border-white/[0.06] flex flex-col justify-between p-3">
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-gradient-to-r from-emerald-500/[0.14] to-cyan-500/[0.06] text-emerald-300 border border-emerald-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    active ? "text-emerald-400" : "text-slate-500"
                  }`}
                />
                <span>{item.label}</span>
              </span>

              {item.id === "profiles" && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400">
                  {profileCount}
                </span>
              )}
              {item.id === "connections" && isConnected && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300">
                  {connectionCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Engine Status Card */}
      <div className="p-3 rounded-xl bg-[#101622] border border-white/[0.06] space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            sing-box
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
              status?.coreInstalled
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/15 text-rose-300"
            }`}
          >
            {shortVersion}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Режим</span>
          <span className="font-mono text-slate-300">
            {status?.mode === "systemProxy" ? "SysProxy" : "TUN (Global)"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Статус</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              isConnected
                ? "text-emerald-400"
                : status?.state === "connecting"
                ? "text-amber-400"
                : status?.state === "error"
                ? "text-rose-400"
                : "text-slate-500"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                  : status?.state === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : status?.state === "error"
                  ? "bg-rose-400"
                  : "bg-slate-600"
              }`}
            />
            {isConnected
              ? "Подключён"
              : status?.state === "connecting"
              ? "Запуск..."
              : status?.state === "error"
              ? "Ошибка"
              : "Отключён"}
          </span>
        </div>
      </div>
    </aside>
  );
};
