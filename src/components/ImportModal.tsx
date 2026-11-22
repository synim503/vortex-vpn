import React, { useState } from "react";
import { X, ClipboardPaste, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "../api/tauri";

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  onClose,
  onImported,
}) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setText(clip);
        setError(null);
      }
    } catch {
      setError("Нет доступа к буферу обмена — вставьте вручную (Ctrl+V)");
    }
  };

  const handleImport = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const imported = await api.importProfiles(text);
      setSuccessMsg(`Успешно добавлено профилей: ${imported.length}`);
      onImported();
      setTimeout(() => onClose(), 650);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111722] border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-100">
              Импорт серверов
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Поддерживаются JSON-конфиги sing-box (outbounds) и ссылки vless://
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Вставьте JSON или одну / несколько ссылок vless:// (по строкам)
            </span>
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-slate-200 transition-colors cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
              Из буфера обмена
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder={`{\n  "outbounds": [\n    {\n      "type": "vless",\n      "tag": "Reality-FI",\n      "server": "...",\n      ...\n    }\n  ]\n}\n\nили vless://uuid@host:443?security=reality&flow=xtls-rprx-vision&...`}
            rows={11}
            className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none p-3.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 resize-none"
          />

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#0C1018] border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !text.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {loading ? "Разбор..." : "Импортировать"}
          </button>
        </div>
      </div>
    </div>
  );
};
