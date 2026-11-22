import React, { useState } from "react";
import {
  Globe,
  Split,
  Sliders,
  Plus,
  X,
  AppWindow,
  RefreshCw,
  Network,
  ShieldOff,
} from "lucide-react";
import type { AppSettings, RoutingMode } from "../types/vpn";
import { api } from "../api/tauri";

interface RoutingProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const QUICK_APPS = ["steam.exe", "discord.exe", "qbittorrent.exe", "Telegram.exe", "epicgameslauncher.exe"];

export const Routing: React.FC<RoutingProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [procInput, setProcInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [runningProcs, setRunningProcs] = useState<string[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);

  const routing = settings.routing;

  const updateRouting = (patch: Partial<AppSettings["routing"]>) => {
    onUpdateSettings({
      ...settings,
      routing: { ...routing, ...patch },
    });
  };

  const addItem = (
    field: "bypassProcesses" | "bypassDomains" | "bypassIps",
    raw: string,
    clear: () => void
  ) => {
    const val = raw.trim();
    if (!val) return;
    if (!routing[field].includes(val)) {
      updateRouting({ [field]: [...routing[field], val] });
    }
    clear();
  };

  const removeItem = (
    field: "bypassProcesses" | "bypassDomains" | "bypassIps",
    val: string
  ) => {
    updateRouting({ [field]: routing[field].filter((x) => x !== val) });
  };

  const loadRunningProcesses = async () => {
    setLoadingProcs(true);
    try {
      const list = await api.getRunningProcesses();
      setRunningProcs(list);
    } finally {
      setLoadingProcs(false);
    }
  };

  const presets: {
    id: RoutingMode;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "global",
      title: "Весь трафик (Global)",
      desc: "100% интернет-трафика Windows идёт через VPN-туннель",
      icon: Globe,
    },
    {
      id: "bypassRu",
      title: "Обход РФ (.ru / .рф)",
      desc: "Российские сайты и сервисы напрямую, остальной мир через VPN",
      icon: Split,
    },
    {
      id: "custom",
      title: "Свои правила",
      desc: "Всё через VPN, кроме указанных ниже доменов, IP и приложений",
      icon: Sliders,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">
          Маршрутизация и Split Tunneling
        </h1>
        <p className="text-xs text-slate-400">
          Управляйте тем, какой трафик, домены и Windows-приложения идут через VPN или напрямую
        </p>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {presets.map((p) => {
          const Icon = p.icon;
          const active = routing.mode === p.id;
          return (
            <button
              key={p.id}
              onClick={() => updateRouting({ mode: p.id })}
              className={`rounded-2xl p-4 border text-left transition-all cursor-pointer ${
                active
                  ? "bg-emerald-500/[0.1] border-emerald-500/40"
                  : "bg-[#10151E]/90 border-white/[0.06] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/[0.05] text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-100">
                  {p.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {p.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toggles: Bypass LAN & Block QUIC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex items-center gap-3">
            <Network className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                Обход локальной сети (LAN)
              </div>
              <div className="text-[11px] text-slate-400">
                Доступ к роутеру, localhost и локальным принтерам напрямую
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={routing.bypassLan}
            onChange={(e) => updateRouting({ bypassLan: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </label>

        <label className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex items-center gap-3">
            <ShieldOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                Блокировать QUIC (UDP 443)
              </div>
              <div className="text-[11px] text-slate-400">
                Переводит браузеры на стабильный TCP/TLS — убирает подвисания YouTube/Chrome
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={routing.blockQuic}
            onChange={(e) => updateRouting({ blockQuic: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Process Split Tunneling */}
      <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AppWindow className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-slate-100">
                Исключения по приложениям (идут в обход VPN)
              </div>
              <div className="text-[11px] text-slate-400">
                Удобно для онлайн-игр, торрентов или банковских клиентов (работает в любом режиме)
              </div>
            </div>
          </div>
          <button
            onClick={loadRunningProcesses}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[11px] text-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingProcs ? "animate-spin" : ""}`} />
            Запущенные процессы
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={procInput}
            onChange={(e) => setProcInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem("bypassProcesses", procInput, () => setProcInput(""));
            }}
            placeholder="Например: steam.exe"
            className="flex-1 rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
          />
          <button
            onClick={() => addItem("bypassProcesses", procInput, () => setProcInput(""))}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Running processes dropdown picker */}
        {runningProcs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl bg-[#090D14] border border-white/[0.06]">
            {runningProcs.map((proc) => (
              <button
                key={proc}
                onClick={() => addItem("bypassProcesses", proc, () => {})}
                className="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-emerald-500/20 text-[11px] font-mono text-slate-300 hover:text-emerald-200 cursor-pointer"
              >
                + {proc}
              </button>
            ))}
          </div>
        )}

        {/* Quick suggestions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500 mr-1">Быстро добавить:</span>
          {QUICK_APPS.filter((a) => !routing.bypassProcesses.includes(a)).map((app) => (
            <button
              key={app}
              onClick={() => addItem("bypassProcesses", app, () => {})}
              className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.09] text-[10px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              + {app}
            </button>
          ))}
        </div>

        {/* Selected chips */}
        {routing.bypassProcesses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {routing.bypassProcesses.map((proc) => (
              <span
                key={proc}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono text-emerald-300"
              >
                {proc}
                <button
                  onClick={() => removeItem("bypassProcesses", proc)}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Domain & IP Bypass Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-100">
              Исключения по доменам (Direct)
            </div>
            <div className="text-[11px] text-slate-400">
              Работают в режимах «Обход РФ» и «Свои правила»
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem("bypassDomains", domainInput, () => setDomainInput(""));
              }}
              placeholder="gosuslugi.ru или .ru"
              className="flex-1 rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
            />
            <button
              onClick={() => addItem("bypassDomains", domainInput, () => setDomainInput(""))}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {routing.bypassDomains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono text-cyan-300"
              >
                {d}
                <button onClick={() => removeItem("bypassDomains", d)} className="cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-100">
              Исключения по IP / CIDR (Direct)
            </div>
            <div className="text-[11px] text-slate-400">
              Подсети или отдельные IP, идущие мимо туннеля
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem("bypassIps", ipInput, () => setIpInput(""));
              }}
              placeholder="192.168.1.0/24"
              className="flex-1 rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
            />
            <button
              onClick={() => addItem("bypassIps", ipInput, () => setIpInput(""))}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {routing.bypassIps.map((ip) => (
              <span
                key={ip}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono text-indigo-300"
              >
                {ip}
                <button onClick={() => removeItem("bypassIps", ip)} className="cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
