import React, { useState } from "react";
import { X, Save, Shield } from "lucide-react";
import type { VlessProfile } from "../types/vpn";

interface ServerEditorModalProps {
  profile: VlessProfile | null;
  onClose: () => void;
  onSave: (profile: VlessProfile) => Promise<void>;
}

const EMPTY_PROFILE: VlessProfile = {
  id: "",
  tag: "Новый VLESS Reality",
  server: "",
  serverPort: 443,
  uuid: "",
  flow: "xtls-rprx-vision",
  tlsEnabled: true,
  serverName: "www.apple.com",
  utlsEnabled: true,
  utlsFingerprint: "chrome",
  realityEnabled: true,
  realityPublicKey: "",
  realityShortId: "",
  packetEncoding: "xudp",
};

export const ServerEditorModal: React.FC<ServerEditorModalProps> = ({
  profile,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<VlessProfile>(profile ? { ...profile } : { ...EMPTY_PROFILE });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof VlessProfile>(key: K, val: VlessProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.server.trim() || !form.uuid.trim()) {
      setErr("Укажите адрес сервера и UUID");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (error) {
      setErr(String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-[#111722] border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-100">
                {profile ? "Редактировать сервер" : "Добавить VLESS сервер"}
              </h2>
              <p className="text-xs text-slate-400">
                VLESS • REALITY • XTLS Vision • uTLS • XUDP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Название (Tag)
              </label>
              <input
                value={form.tag}
                onChange={(e) => set("tag", e.target.value)}
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Сервер (IP или домен)
              </label>
              <input
                value={form.server}
                onChange={(e) => set("server", e.target.value)}
                placeholder="203.0.113.42"
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Порт
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={form.serverPort}
                onChange={(e) => set("serverPort", Number(e.target.value) || 443)}
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                UUID
              </label>
              <input
                value={form.uuid}
                onChange={(e) => set("uuid", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Flow
              </label>
              <select
                value={form.flow}
                onChange={(e) => set("flow", e.target.value)}
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              >
                <option value="xtls-rprx-vision">xtls-rprx-vision</option>
                <option value="">(нет)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Packet Encoding
              </label>
              <select
                value={form.packetEncoding}
                onChange={(e) => set("packetEncoding", e.target.value)}
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              >
                <option value="xudp">xudp</option>
                <option value="packetaddr">packetaddr</option>
                <option value="">(нет)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                uTLS Fingerprint
              </label>
              <select
                value={form.utlsFingerprint}
                onChange={(e) => set("utlsFingerprint", e.target.value)}
                className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
              >
                <option value="chrome">chrome</option>
                <option value="firefox">firefox</option>
                <option value="safari">safari</option>
                <option value="edge">edge</option>
                <option value="ios">ios</option>
                <option value="random">random</option>
                <option value="randomized">randomized</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] space-y-3">
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.tlsEnabled}
                  onChange={(e) => set("tlsEnabled", e.target.checked)}
                  className="accent-emerald-500"
                />
                TLS включён
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.utlsEnabled}
                  onChange={(e) => set("utlsEnabled", e.target.checked)}
                  className="accent-emerald-500"
                />
                uTLS Fingerprint
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.realityEnabled}
                  onChange={(e) => set("realityEnabled", e.target.checked)}
                  className="accent-emerald-500"
                />
                REALITY
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  SNI (Server Name)
                </label>
                <input
                  value={form.serverName}
                  onChange={(e) => set("serverName", e.target.value)}
                  placeholder="www.apple.com"
                  className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  REALITY Public Key
                </label>
                <input
                  value={form.realityPublicKey}
                  onChange={(e) => set("realityPublicKey", e.target.value)}
                  className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  REALITY Short ID
                </label>
                <input
                  value={form.realityShortId}
                  onChange={(e) => set("realityShortId", e.target.value)}
                  className="w-full rounded-xl bg-[#090D14] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none px-3 py-2 text-xs font-mono text-slate-100"
                />
              </div>
            </div>
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#0C1018] border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
};
