import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Trash2,
  Copy,
  Check,
  FileJson,
  ArrowDownToLine,
} from "lucide-react";
import type { LogEntry } from "../types/vpn";
import { ConfigPreviewModal } from "../components/ConfigPreviewModal";

interface LogsProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LEVELS = ["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as const;

export const Logs: React.FC<LogsProps> = ({ logs, onClear }) => {
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (levelFilter !== "ALL" && l.level !== levelFilter) return false;
      if (q && !l.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, levelFilter, query]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [filtered.length, autoScroll]);

  const handleCopyAll = () => {
    const text = filtered
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const levelBadge = (level: string) => {
    switch (level) {
      case "ERROR":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "WARN":
        return "text-amber-300 bg-amber-500/10 border-amber-500/20";
      case "DEBUG":
        return "text-slate-400 bg-white/[0.05] border-white/[0.08]";
      default:
        return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    }
  };

  return (
    <div className="h-full flex flex-col p-5 gap-3.5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Логи и диагностика
          </h1>
          <p className="text-xs text-slate-400">
            Поток событий ядра sing-box и предпросмотр итоговой конфигурации
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigPreview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-xs font-medium text-cyan-300 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            Конфиг sing-box
          </button>
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Копировать
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-rose-500/15 border border-white/[0.08] text-xs text-slate-300 hover:text-rose-300 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистить
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#10151E] border border-white/[0.06]">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                levelFilter === lvl
                  ? "bg-white/[0.1] text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск в логах..."
              className="w-52 rounded-xl bg-[#10151E] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none pl-8 pr-3 py-1.5 text-xs text-slate-100"
            />
          </div>

          <button
            onClick={() => setAutoScroll((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium cursor-pointer ${
              autoScroll
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-[#10151E] border-white/[0.08] text-slate-400"
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Автоскролл
          </button>
        </div>
      </div>

      {/* Console output */}
      <div className="flex-1 rounded-2xl bg-[#090C12] border border-white/[0.06] overflow-y-auto p-3 font-mono text-[11.5px] space-y-1 selectable">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            Логов пока нет — подключитесь к серверу
          </div>
        ) : (
          filtered.map((l) => (
            <div
              key={l.id}
              className="flex items-start gap-2 leading-relaxed hover:bg-white/[0.02] px-1.5 py-0.5 rounded"
            >
              <span className="text-slate-600 shrink-0">{l.timestamp}</span>
              <span
                className={`px-1.5 py-0 rounded border text-[10px] font-semibold shrink-0 ${levelBadge(
                  l.level
                )}`}
              >
                {l.level}
              </span>
              <span className="text-slate-300 break-all">{l.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {showConfigPreview && (
        <ConfigPreviewModal onClose={() => setShowConfigPreview(false)} />
      )}
    </div>
  );
};
