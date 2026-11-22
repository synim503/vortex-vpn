import React, { useMemo, useState } from "react";
import { Search, Trash2, X, Activity } from "lucide-react";
import type { ConnectionsSnapshot } from "../types/vpn";
import { api, formatBytes } from "../api/tauri";

interface ConnectionsProps {
  snapshot: ConnectionsSnapshot;
  isConnected: boolean;
  onRefresh: () => void;
}

export const Connections: React.FC<ConnectionsProps> = ({
  snapshot,
  isConnected,
  onRefresh,
}) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snapshot.connections;
    return snapshot.connections.filter(
      (c) =>
        c.host.toLowerCase().includes(q) ||
        c.process.toLowerCase().includes(q) ||
        c.destinationIp.toLowerCase().includes(q) ||
        c.chains.join(" ").toLowerCase().includes(q)
    );
  }, [snapshot.connections, query]);

  const handleClose = async (id?: string) => {
    try {
      await api.closeConnection(id);
      onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Активные соединения
          </h1>
          <p className="text-xs text-slate-400">
            Реальное время: процессы, хосты, маршруты и объём трафика ({filtered.length})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фильтр по хосту / процессу..."
              className="w-56 rounded-xl bg-[#10151E] border border-white/[0.08] focus:border-emerald-500/50 focus:outline-none pl-8 pr-3 py-1.5 text-xs text-slate-100"
            />
          </div>
          {isConnected && snapshot.connections.length > 0 && (
            <button
              onClick={() => handleClose(undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-medium text-rose-300 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Закрыть все
            </button>
          )}
        </div>
      </div>

      {!isConnected ? (
        <div className="flex-1 rounded-2xl bg-[#10151E]/60 border border-white/[0.05] flex flex-col items-center justify-center text-slate-500 gap-2">
          <Activity className="w-8 h-8 text-slate-600" />
          <div className="text-sm font-medium text-slate-400">
            VPN не подключён
          </div>
          <div className="text-xs">
            Подключитесь, чтобы видеть живые сетевые соединения Windows
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl bg-[#10151E]/90 border border-white/[0.06] overflow-hidden flex flex-col">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#0C1018] border-b border-white/[0.06] text-[10px] uppercase tracking-wider font-semibold text-slate-500 shrink-0">
            <div className="col-span-4">Хост / Назначение</div>
            <div className="col-span-2">Процесс</div>
            <div className="col-span-2">Маршрут</div>
            <div className="col-span-1 text-center">Протокол</div>
            <div className="col-span-2 text-right">↓ / ↑</div>
            <div className="col-span-1 text-right"></div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Нет активных соединений по заданному фильтру
              </div>
            ) : (
              filtered.map((c) => {
                const chain = c.chains[0] ?? "proxy";
                const isDirect = chain.toLowerCase() === "direct";
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="col-span-4 min-w-0">
                      <div className="font-mono text-slate-200 truncate selectable">
                        {c.host}:{c.destinationPort}
                      </div>
                      {c.destinationIp && c.destinationIp !== c.host && (
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {c.destinationIp}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 font-mono text-[11px] text-slate-300 truncate">
                      {c.process}
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                          isDirect
                            ? "bg-slate-500/15 text-slate-300 border border-slate-500/25"
                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                        }`}
                      >
                        {chain.toUpperCase()}
                      </span>
                    </div>

                    <div className="col-span-1 text-center font-mono text-[10px] text-slate-400">
                      {c.network}
                    </div>

                    <div className="col-span-2 text-right font-mono text-[11px]">
                      <span className="text-emerald-400">{formatBytes(c.download)}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-cyan-400">{formatBytes(c.upload)}</span>
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => handleClose(c.id)}
                        title="Разорвать соединение"
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
