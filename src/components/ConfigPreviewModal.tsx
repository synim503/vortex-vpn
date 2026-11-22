import React, { useEffect, useState } from "react";
import { X, Copy, Check, FileJson } from "lucide-react";
import { api } from "../api/tauri";

interface ConfigPreviewModalProps {
  onClose: () => void;
}

export const ConfigPreviewModal: React.FC<ConfigPreviewModalProps> = ({
  onClose,
}) => {
  const [jsonText, setJsonText] = useState("Загрузка...");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .previewSingboxConfig()
      .then(setJsonText)
      .catch((e) => setJsonText(`Ошибка: ${e}`));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-[#111722] border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Сгенерированная конфигурация sing-box
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-slate-200 cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre className="p-4 overflow-auto text-[11.5px] leading-relaxed font-mono text-emerald-200/90 bg-[#080B10] flex-1">
          {jsonText}
        </pre>
      </div>
    </div>
  );
};
