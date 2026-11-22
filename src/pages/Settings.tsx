import React from "react";
import {
  Shield,
  Cpu,
  Download,
  ShieldCheck,
  Globe,
  Sliders,
  Power,
} from "lucide-react";
import type {
  AppSettings,
  DnsPreset,
  Ipv6Mode,
  VpnStatus,
} from "../types/vpn";

interface SettingsProps {
  settings: AppSettings;
  status: VpnStatus | null;
  onUpdateSettings: (settings: AppSettings, reconnect?: boolean) => void;
  onElevate: () => void;
  onDownloadCore: () => void;
  downloadingCore: boolean;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  status,
  onUpdateSettings,
  onElevate,
  onDownloadCore,
  downloadingCore,
}) => {
  const set = <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K],
    reconnect = true
  ) => {
    onUpdateSettings({ ...settings, [key]: val }, reconnect);
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Настройки</h1>
        <p className="text-xs text-slate-400">
          Тонкая настройка TUN-адаптера Wintun, DNS без утечек, портов и ядра sing-box
        </p>
      </div>

      {/* DNS Settings */}
      <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>Защищённый DNS (через VPN-туннель)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(
            [
              ["cloudflare", "Cloudflare DoH", "1.1.1.1"],
              ["google", "Google DoH", "8.8.8.8"],
              ["adGuard", "AdGuard DoH", "Блок рекламы"],
              ["quad9", "Quad9 DoH", "9.9.9.9"],
              ["custom", "Свой DNS", "DoH / UDP"],
            ] as [DnsPreset, string, string][]
          ).map(([id, name, sub]) => (
            <button
              key={id}
              onClick={() => set("dnsPreset", id)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                settings.dnsPreset === id
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-200"
                  : "bg-[#0A0E15] border-white/[0.06] text-slate-300 hover:border-white/[0.15]"
              }`}
            >
              <div className="text-xs font-semibold">{name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
            </button>
          ))}
        </div>

        {settings.dnsPreset === "custom" && (
          <input
            value={settings.customDns}
            onChange={(e) => set("customDns", e.target.value, false)}
            placeholder="https://1.1.1.1/dns-query или 8.8.8.8"
            className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
          />
        )}
      </div>

      {/* TUN & Leak Protection */}
      <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Параметры TUN (Wintun) и защита от утечек</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              TUN Stack
            </label>
            <select
              value={settings.tunStack}
              onChange={(e) => set("tunStack", e.target.value)}
              className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-100"
            >
              <option value="mixed">mixed (рекомендуется)</option>
              <option value="system">system (высокая скорость)</option>
              <option value="gvisor">gvisor (макс. совместимость)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              MTU
            </label>
            <input
              type="number"
              min={1280}
              max={9000}
              value={settings.tunMtu}
              onChange={(e) => set("tunMtu", Number(e.target.value) || 1500)}
              className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              IPv6 политика
            </label>
            <select
              value={settings.ipv6Mode}
              onChange={(e) => set("ipv6Mode", e.target.value as Ipv6Mode)}
              className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] px-3 py-2 text-xs text-slate-100"
            >
              <option value="block">Блокировать IPv6 (без утечек)</option>
              <option value="route">Маршрутизировать через VPN</option>
              <option value="direct">Не перехватывать</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Локальный порт SOCKS5 / HTTP
            </label>
            <input
              type="number"
              value={settings.mixedPort}
              onChange={(e) => set("mixedPort", Number(e.target.value) || 10808)}
              className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Уровень логирования
            </label>
            <select
              value={settings.logLevel}
              onChange={(e) => set("logLevel", e.target.value)}
              className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-100"
            >
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="debug">debug</option>
            </select>
          </div>
        </div>
      </div>

      {/* App Behavior */}
      <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Поведение приложения</span>
        </div>

        <label className="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <div className="text-xs text-slate-200">
              Сворачивать в системный трей при закрытии окна
            </div>
            <div className="text-[11px] text-slate-500">
              VPN продолжит работать в фоне. Полный выход — через правый клик по иконке в трее.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => set("minimizeToTray", e.target.checked, false)}
            className="w-4 h-4 accent-emerald-500"
          />
        </label>

        <label className="flex items-center justify-between py-1 cursor-pointer">
          <div>
            <div className="text-xs text-slate-200">
              Автоподключение при запуске Vortex VPN
            </div>
            <div className="text-[11px] text-slate-500">
              Автоматически поднимать туннель сразу после открытия клиента
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoConnect}
            onChange={(e) => set("autoConnect", e.target.checked, false)}
            className="w-4 h-4 accent-emerald-500"
          />
        </label>
      </div>

      {/* Engine & Privileges */}
      <div className="rounded-2xl bg-[#10151E]/90 border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Ядро sing-box и права Windows</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0A0E15] border border-white/[0.05]">
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-mono text-slate-200">
              {status?.coreVersion ?? "sing-box не установлен"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 truncate max-w-md">
              {status?.corePath ?? "Путь не найден"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!status?.isAdmin && (
              <button
                onClick={onElevate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-medium text-amber-300 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Права Admin
              </button>
            )}
            <button
              onClick={onDownloadCore}
              disabled={downloadingCore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-medium text-emerald-300 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingCore ? "Скачивание..." : "Обновить ядро"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Power className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Windows Job Object активен: при любом аварийном завершении ядро sing-box и Wintun-маршруты автоматически очищаются системой.
          </span>
        </div>
      </div>
    </div>
  );
};
