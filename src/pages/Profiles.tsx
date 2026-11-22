import React, { useState } from "react";
import {
  Plus,
  Download,
  Gauge,
  Pencil,
  Trash2,
  Copy,
  Check,
  FileJson,
  CheckCircle2,
  Wifi,
} from "lucide-react";
import type { AppConfig, VlessProfile } from "../types/vpn";
import { api } from "../api/tauri";
import { ImportModal } from "../components/ImportModal";
import { ServerEditorModal } from "../components/ServerEditorModal";

interface ProfilesProps {
  config: AppConfig;
  onRefreshConfig: () => Promise<void>;
  onSelectProfile: (id: string) => void;
  onSaveProfile: (profile: VlessProfile) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
}

export const Profiles: React.FC<ProfilesProps> = ({
  config,
  onRefreshConfig,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<VlessProfile | null | undefined>(undefined);
  const [pingingAll, setPingingAll] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handlePingOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPingingId(id);
    try {
      await api.pingProfile(id);
      await onRefreshConfig();
    } finally {
      setPingingId(null);
    }
  };

  const handlePingAll = async () => {
    setPingingAll(true);
    try {
      await api.pingAllProfiles();
      await onRefreshConfig();
    } finally {
      setPingingAll(false);
    }
  };

  const handleCopy = async (
    id: string,
    format: "json" | "uri",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      const exported = await api.exportProfile(id, format);
      await navigator.clipboard.writeText(exported);
      const key = `${id}-${format}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore
    }
  };

  const latencyBadgeClass = (ms: number) => {
    if (ms < 90) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
    if (ms < 220) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
    return "bg-rose-500/15 text-rose-300 border-rose-500/25";
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Серверы</h1>
          <p className="text-xs text-slate-400">
            Управление VLESS REALITY профилями, импорт JSON / vless:// и замер задержки
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingAll}
            disabled={pingingAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Gauge className={`w-3.5 h-3.5 text-cyan-400 ${pingingAll ? "animate-spin" : ""}`} />
            {pingingAll ? "Проверка..." : "Пинг всех"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Импорт JSON / URI
          </button>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-950 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {config.profiles.map((p) => {
          const isActive = p.id === config.activeProfileId;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProfile(p.id)}
              className={`group rounded-2xl p-4 border transition-all cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-emerald-500/[0.1] via-[#111824] to-[#111824] border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.08)]"
                  : "bg-[#10151E]/90 border-white/[0.06] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-emerald-500/20 border border-emerald-500/35 text-emerald-300"
                        : "bg-white/[0.04] border border-white/[0.07] text-slate-400"
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {p.tag}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          Активный
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5 truncate">
                      {p.server}:{p.serverPort}
                      {p.serverName ? ` • SNI: ${p.serverName}` : ""}
                    </div>
                  </div>
                </div>

                {/* Right: Latency & Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handlePingOne(p.id, e)}
                    title="Проверить TCP задержку"
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer ${
                      p.latencyMs != null
                        ? latencyBadgeClass(p.latencyMs)
                        : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {pingingId === p.id
                      ? "..."
                      : p.latencyMs != null
                      ? `${p.latencyMs} ms`
                      : "Пинг"}
                  </button>

                  <button
                    onClick={(e) => handleCopy(p.id, "uri", e)}
                    title="Копировать vless:// ссылку"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    {copiedKey === `${p.id}-uri` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={(e) => handleCopy(p.id, "json", e)}
                    title="Копировать sing-box JSON"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    {copiedKey === `${p.id}-json` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <FileJson className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(p);
                    }}
                    title="Редактировать"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  {config.profiles.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProfile(p.id);
                      }}
                      title="Удалить"
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Protocol Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-[10px] font-mono text-emerald-300">
                  VLESS
                </span>
                {p.realityEnabled && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-[10px] font-mono text-cyan-300">
                    REALITY
                  </span>
                )}
                {p.flow && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-[10px] font-mono text-indigo-300">
                    {p.flow}
                  </span>
                )}
                {p.utlsEnabled && (
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[10px] font-mono text-slate-300">
                    uTLS: {p.utlsFingerprint}
                  </span>
                )}
                {p.packetEncoding && (
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.05] text-[10px] font-mono text-slate-300">
                    {p.packetEncoding}
                  </span>
                )}
                {p.realityShortId && (
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] font-mono text-slate-500">
                    sid: {p.realityShortId}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={onRefreshConfig}
        />
      )}

      {editing !== undefined && (
        <ServerEditorModal
          profile={editing}
          onClose={() => setEditing(undefined)}
          onSave={onSaveProfile}
        />
      )}
    </div>
  );
};
