import React, { useEffect, useState } from "react";
import {
  Power,
  ShieldAlert,
  Globe,
  RefreshCw,
  ShieldCheck,
  Zap,
  Lock,
  Radio,
  Download,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import type {
  AppConfig,
  AppSettings,
  IpInfo,
  ProxyMode,
  RoutingMode,
  TrafficStats,
  VpnStatus,
} from "../types/vpn";
import { api, formatDuration } from "../api/tauri";
import { TrafficChart } from "../components/TrafficChart";

interface DashboardProps {
  config: AppConfig;
  status: VpnStatus | null;
  traffic: TrafficStats;
  trafficHistory: TrafficStats[];
  onToggleConnect: () => void;
  onSelectProfile: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onElevate: () => void;
  onDownloadCore: () => void;
  downloadingCore: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  config,
  status,
  traffic,
  trafficHistory,
  onToggleConnect,
  onSelectProfile,
  onUpdateSettings,
  onElevate,
  onDownloadCore,
  downloadingCore,
}) => {
  const [now, setNow] = useState(Date.now());
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [checkingIp, setCheckingIp] = useState(false);

  const state = status?.state ?? "disconnected";
  const isConnected = state === "connected";
  const isConnecting = state === "connecting";
  const isError = state === "error";

  const activeProfile =
    config.profiles.find((p) => p.id === config.activeProfileId) ??
    config.profiles[0] ??
    null;

  // Live session duration ticker
  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  // Auto-check external IP shortly after connection settles
  const refreshIp = async () => {
    setCheckingIp(true);
    try {
      const info = await api.checkExternalIp();
      setIpInfo(info);
    } catch {
      // keep previous or null silently
    } finally {
      setCheckingIp(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => {
        refreshIp();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isConnected, config.activeProfileId]);

  const setProxyMode = (proxyMode: ProxyMode) => {
    onUpdateSettings({ ...config.settings, proxyMode });
  };

  const setRoutingMode = (mode: RoutingMode) => {
    onUpdateSettings({
      ...config.settings,
      routing: { ...config.settings.routing, mode },
    });
  };

  const toggleAdBlock = () => {
    const next =
      config.settings.dnsPreset === "adGuard" ? "cloudflare" : "adGuard";
    onUpdateSettings({ ...config.settings, dnsPreset: next });
  };

  const toggleStrictRoute = () => {
    onUpdateSettings({
      ...config.settings,
      strictRoute: !config.settings.strictRoute,
    });
  };

  const durationText =
    isConnected && status?.connectedSince
      ? formatDuration(now - status.connectedSince)
      : "00:00:00";

  const needsAdminForTun =
    config.settings.proxyMode === "tun" && status && !status.isAdmin;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      {/* Core missing alert */}
      {status && !status.coreInstalled && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-rose-200">
                Ядро sing-box.exe не найдено
              </div>
              <div className="text-[11px] text-rose-300/80">
                Нажмите кнопку справа, чтобы автоматически скачать официальное ядро sing-box с GitHub.
              </div>
            </div>
          </div>
          <button
            onClick={onDownloadCore}
            disabled={downloadingCore}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-xs font-semibold text-white shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {downloadingCore ? "Загрузка..." : "Скачать ядро"}
          </button>
        </div>
      )}

      {/* Smart UAC Admin Banner for TUN mode */}
      {needsAdminForTun && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-200">
                Для режима TUN (маршрутизация всего трафика Windows) нужны права администратора
              </div>
              <div className="text-[11px] text-amber-200/70 mt-0.5">
                Запустите Vortex VPN от администратора или переключитесь на режим «Системный прокси».
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProxyMode("systemProxy")}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-slate-200 cursor-pointer"
            >
              Системный прокси
            </button>
            <button
              onClick={onElevate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-slate-950 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Запустить от Admin
            </button>
          </div>
        </div>
      )}

      {/* Hero Connection Area */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#111824] to-[#0D121B] border border-white/[0.07] p-6 overflow-hidden shadow-2xl">
        {/* Ambient radial glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[480px] h-[240px] rounded-full blur-[90px] transition-all duration-700 ${
            isConnected
              ? "bg-emerald-500/20"
              : isConnecting
              ? "bg-amber-500/20"
              : isError
              ? "bg-rose-500/20"
              : "bg-indigo-500/10"
          }`}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left/Center: Glowing Power Orb */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center py-2">
            <div className="relative flex items-center justify-center">
              {/* Animated Outer Pulse Ring */}
              {(isConnected || isConnecting) && (
                <div
                  className={`absolute w-36 h-36 rounded-full border-2 animate-pulse-ring ${
                    isConnected ? "border-emerald-400/50" : "border-amber-400/50"
                  }`}
                />
              )}

              {/* Connecting Spinner Halo */}
              {isConnecting && (
                <div className="absolute w-36 h-36 rounded-full border-2 border-transparent border-t-amber-400 border-r-amber-400/40 animate-spin-slow" />
              )}

              <button
                onClick={onToggleConnect}
                disabled={isConnecting}
                className={`relative w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 ${
                  isConnected
                    ? "bg-gradient-to-b from-emerald-400/25 to-emerald-600/15 border-2 border-emerald-400/70 shadow-[0_0_50px_rgba(16,185,129,0.35),inset_0_1px_12px_rgba(110,231,183,0.35)] hover:shadow-[0_0_65px_rgba(16,185,129,0.5)]"
                    : isConnecting
                    ? "bg-gradient-to-b from-amber-400/20 to-amber-600/10 border-2 border-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.28)]"
                    : "bg-gradient-to-b from-[#1A2333] to-[#111722] border-2 border-white/[0.12] hover:border-emerald-400/45 shadow-[0_10px_35px_rgba(0,0,0,0.55)] hover:shadow-[0_0_40px_rgba(16,185,129,0.18)]"
                }`}
              >
                <Power
                  className={`w-11 h-11 transition-all duration-300 ${
                    isConnected
                      ? "text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                      : isConnecting
                      ? "text-amber-300 animate-pulse"
                      : "text-slate-300"
                  }`}
                />
                <span
                  className={`mt-1.5 text-[10px] uppercase tracking-widest font-semibold ${
                    isConnected
                      ? "text-emerald-300"
                      : isConnecting
                      ? "text-amber-300"
                      : "text-slate-400"
                  }`}
                >
                  {isConnected
                    ? "Активен"
                    : isConnecting
                    ? "Запуск"
                    : "Включить"}
                </span>
              </button>
            </div>

            <div className="mt-4 text-center">
              <div
                className={`text-sm font-semibold ${
                  isConnected
                    ? "text-emerald-300"
                    : isConnecting
                    ? "text-amber-300"
                    : isError
                    ? "text-rose-400"
                    : "text-slate-200"
                }`}
              >
                {isConnected
                  ? config.settings.proxyMode === "tun"
                    ? "Защищено • Весь трафик через TUN"
                    : "Защищено • Системный прокси"
                  : isConnecting
                  ? "Установка туннеля VLESS Reality..."
                  : isError
                  ? "Ошибка подключения"
                  : "Соединение отключено"}
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400">
                {isConnected ? `Сессия: ${durationText}` : "Нажмите кнопку для запуска VPN"}
              </div>
            </div>

            {isError && status?.errorMessage && (
              <div className="mt-3 max-w-sm text-center text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                {status.errorMessage}
              </div>
            )}
          </div>

          {/* Right: Active Server + External IP Card */}
          <div className="lg:col-span-7 space-y-3">
            {/* Active Server Selector Card */}
            <div className="rounded-2xl bg-[#0B1018]/90 border border-white/[0.07] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  Активный сервер
                </span>
                {activeProfile?.latencyMs != null && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {activeProfile.latencyMs} ms
                  </span>
                )}
              </div>

              <div className="relative">
                <select
                  value={activeProfile?.id ?? ""}
                  onChange={(e) => onSelectProfile(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-[#131B28] border border-white/[0.08] hover:border-white/[0.16] focus:border-emerald-500/50 focus:outline-none px-3.5 py-2.5 pr-9 text-sm font-semibold text-slate-100 cursor-pointer transition-colors"
                >
                  {config.profiles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#111722]">
                      {p.tag} — {p.server}:{p.serverPort}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              {activeProfile && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300">
                    VLESS
                  </span>
                  {activeProfile.realityEnabled && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono text-cyan-300">
                      REALITY
                    </span>
                  )}
                  {activeProfile.flow && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono text-indigo-300">
                      {activeProfile.flow}
                    </span>
                  )}
                  {activeProfile.utlsEnabled && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-300">
                      uTLS: {activeProfile.utlsFingerprint}
                    </span>
                  )}
                  {activeProfile.packetEncoding && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-300">
                      {activeProfile.packetEncoding.toUpperCase()}
                    </span>
                  )}
                  {activeProfile.serverName && (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] font-mono text-slate-400">
                      SNI: {activeProfile.serverName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* External IP & Geo Card */}
            <div className="rounded-2xl bg-[#0B1018]/90 border border-white/[0.07] p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isConnected
                      ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                      : "bg-white/[0.04] border border-white/[0.07] text-slate-400"
                  }`}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>Внешний IP</span>
                    {ipInfo && (
                      <span className="font-mono text-[10px] text-emerald-400">
                        {ipInfo.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-100 truncate selectable">
                    {ipInfo ? ipInfo.ip : "Нажмите «Проверить»"}
                  </div>
                  {ipInfo && (
                    <div className="text-[11px] text-slate-400 truncate">
                      {[ipInfo.country, ipInfo.city, ipInfo.org]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={refreshIp}
                disabled={checkingIp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-xs font-medium text-slate-200 shrink-0 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${checkingIp ? "animate-spin text-emerald-400" : ""}`}
                />
                <span>{checkingIp ? "..." : "IP"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Control Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Mode Switch */}
        <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Режим захвата</span>
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#090D14] border border-white/[0.05]">
            <button
              onClick={() => setProxyMode("tun")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                config.settings.proxyMode === "tun"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              TUN (Весь)
            </button>
            <button
              onClick={() => setProxyMode("systemProxy")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                config.settings.proxyMode === "systemProxy"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Прокси
            </button>
          </div>
        </div>

        {/* Routing Preset */}
        <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Маршрут</span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#090D14] border border-white/[0.05]">
            <button
              onClick={() => setRoutingMode("global")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                config.settings.routing.mode === "global"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Весь трафик
            </button>
            <button
              onClick={() => setRoutingMode("bypassRu")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                config.settings.routing.mode !== "global"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Обход РФ
            </button>
          </div>
        </div>

        {/* AdBlock DNS */}
        <button
          onClick={toggleAdBlock}
          className={`rounded-2xl border p-3.5 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
            config.settings.dnsPreset === "adGuard"
              ? "bg-emerald-500/[0.09] border-emerald-500/30"
              : "bg-[#10151E]/90 border-white/[0.06] hover:border-white/[0.12]"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-medium text-slate-400">AdBlock DNS</span>
            <ShieldCheck
              className={`w-4 h-4 ${
                config.settings.dnsPreset === "adGuard"
                  ? "text-emerald-400"
                  : "text-slate-500"
              }`}
            />
          </div>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-100">
              {config.settings.dnsPreset === "adGuard" ? "AdGuard DoH" : "Cloudflare DoH"}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                config.settings.dnsPreset === "adGuard"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/[0.06] text-slate-400"
              }`}
            >
              {config.settings.dnsPreset === "adGuard" ? "ВКЛ" : "ВЫКЛ"}
            </span>
          </div>
        </button>

        {/* Strict Route / Kill Switch */}
        <button
          onClick={toggleStrictRoute}
          className={`rounded-2xl border p-3.5 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
            config.settings.strictRoute
              ? "bg-cyan-500/[0.08] border-cyan-500/30"
              : "bg-[#10151E]/90 border-white/[0.06] hover:border-white/[0.12]"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-medium text-slate-400">Strict Route</span>
            <Lock
              className={`w-4 h-4 ${
                config.settings.strictRoute ? "text-cyan-400" : "text-slate-500"
              }`}
            />
          </div>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-100">
              Защита от утечек
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                config.settings.strictRoute
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-white/[0.06] text-slate-400"
              }`}
            >
              {config.settings.strictRoute ? "ВКЛ" : "ВЫКЛ"}
            </span>
          </div>
        </button>
      </div>

      {/* Real-time Speed & Traffic Graph */}
      <TrafficChart
        history={trafficHistory}
        current={traffic}
        mixedPort={config.settings.mixedPort}
        isConnected={isConnected}
      />
    </div>
  );
};
