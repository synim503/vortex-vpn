import React, { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type {
  AppConfig,
  AppSettings,
  ConnectionsSnapshot,
  LogEntry,
  NavTab,
  TrafficStats,
  VlessProfile,
  VpnStatus,
} from "./types/vpn";
import { api, isTauriRuntime } from "./api/tauri";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Profiles } from "./pages/Profiles";
import { Routing } from "./pages/Routing";
import { Connections } from "./pages/Connections";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";

const INITIAL_TRAFFIC: TrafficStats = {
  up: 0,
  down: 0,
  totalUp: 0,
  totalDown: 0,
  timestamp: 0,
};

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [traffic, setTraffic] = useState<TrafficStats>(INITIAL_TRAFFIC);
  const [trafficHistory, setTrafficHistory] = useState<TrafficStats[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connections, setConnections] = useState<ConnectionsSnapshot>({
    uploadTotal: 0,
    downloadTotal: 0,
    connections: [],
  });
  const [downloadingCore, setDownloadingCore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  const refreshConfig = useCallback(async () => {
    const cfg = await api.getConfig();
    setConfig(cfg);
  }, []);

  const refreshConnections = useCallback(async () => {
    try {
      const snap = await api.getConnections();
      setConnections(snap);
    } catch {
      // ignore when disconnected
    }
  }, []);

  // Initial load + Tauri realtime event subscriptions
  useEffect(() => {
    api.getConfig().then(setConfig).catch(console.error);
    api.getStatus().then(setStatus).catch(console.error);
    api.getLogs().then(setLogs).catch(console.error);

    if (!isTauriRuntime()) {
      // Browser preview / screenshot capture mode
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as NavTab | null;
      if (
        tabParam &&
        ["dashboard", "profiles", "routing", "connections", "logs", "settings"].includes(
          tabParam
        )
      ) {
        setActiveTab(tabParam);
      }
      const stateParam = params.get("state");
      if (stateParam === "disconnected" || stateParam === "connecting" || stateParam === "connected") {
        api.getStatus().then((st) =>
          setStatus({
            ...st,
            state: stateParam,
            connectedSince: stateParam === "connected" ? Date.now() - 872_000 : null,
          })
        );
      }

      // Seed smooth realistic speed wave in browser preview
      const phase = Number(params.get("phase") ?? "0") || 0;
      const seed: TrafficStats[] = [];
      let totalDown = 148_200_000;
      let totalUp = 12_400_000;
      for (let i = 0; i < 40; i++) {
        const t = (i + phase) * 0.28;
        const down = Math.round((4.8 + Math.sin(t) * 2.4 + Math.cos(t * 0.55) * 1.4) * 1024 * 1024);
        const up = Math.round((1.1 + Math.cos(t * 0.8) * 0.45 + Math.sin(t * 0.4) * 0.25) * 1024 * 1024);
        totalDown += down;
        totalUp += up;
        seed.push({ up, down, totalUp, totalDown, timestamp: Date.now() - (40 - i) * 1000 });
      }
      if (stateParam !== "disconnected" && stateParam !== "connecting") {
        setTrafficHistory(seed);
        setTraffic(seed[seed.length - 1]);
      }
      return;
    }

    let unlistenStatus: (() => void) | undefined;
    let unlistenTraffic: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;

    listen<VpnStatus>("vpn://status", (e) => {
      setStatus(e.payload);
      if (e.payload.state !== "connected") {
        setTraffic(INITIAL_TRAFFIC);
        setConnections({ uploadTotal: 0, downloadTotal: 0, connections: [] });
      }
    }).then((fn) => {
      unlistenStatus = fn;
    });

    listen<TrafficStats>("vpn://traffic", (e) => {
      setTraffic(e.payload);
      setTrafficHistory((prev) => [...prev.slice(-59), e.payload]);
    }).then((fn) => {
      unlistenTraffic = fn;
    });

    listen<LogEntry>("vpn://log", (e) => {
      setLogs((prev) => [...prev.slice(-499), e.payload]);
    }).then((fn) => {
      unlistenLog = fn;
    });

    return () => {
      unlistenStatus?.();
      unlistenTraffic?.();
      unlistenLog?.();
    };
  }, []);

  // Poll active connections every 1.5s while connected
  useEffect(() => {
    if (status?.state !== "connected") return;
    refreshConnections();
    const id = setInterval(refreshConnections, 1500);
    return () => clearInterval(id);
  }, [status?.state, refreshConnections]);

  const handleToggleConnect = async () => {
    if (status?.state === "connected" || status?.state === "connecting") {
      try {
        const st = await api.disconnectVpn();
        setStatus(st);
      } catch (e) {
        showToast(String(e));
      }
    } else {
      try {
        setTrafficHistory([]);
        const st = await api.connectVpn();
        setStatus(st);
      } catch (e) {
        showToast(String(e));
        const st = await api.getStatus();
        setStatus(st);
      }
    }
  };

  const handleSelectProfile = async (id: string) => {
    try {
      const cfg = await api.selectProfile(id);
      setConfig(cfg);
    } catch (e) {
      showToast(String(e));
    }
  };

  const handleSaveProfile = async (profile: VlessProfile) => {
    const cfg = await api.saveProfile(profile);
    setConfig(cfg);
    showToast(`Профиль «${profile.tag}» сохранён`);
  };

  const handleDeleteProfile = async (id: string) => {
    const cfg = await api.deleteProfile(id);
    setConfig(cfg);
    showToast("Профиль удалён");
  };

  const handleUpdateSettings = async (
    next: AppSettings,
    reconnectIfActive = true
  ) => {
    try {
      const cfg = await api.updateSettings(next, reconnectIfActive);
      setConfig(cfg);
    } catch (e) {
      showToast(String(e));
    }
  };

  const handleElevate = async () => {
    try {
      await api.restartAsAdmin();
    } catch (e) {
      showToast(String(e));
    }
  };

  const handleDownloadCore = async () => {
    setDownloadingCore(true);
    try {
      const ver = await api.downloadCore();
      const st = await api.getStatus();
      setStatus(st);
      showToast(`Ядро установлено: ${ver}`);
    } catch (e) {
      showToast(String(e));
    } finally {
      setDownloadingCore(false);
    }
  };

  const handleClearLogs = async () => {
    await api.clearLogs();
    setLogs([]);
  };

  if (!config) {
    return (
      <div className="h-screen w-screen bg-[#080B10] flex items-center justify-center text-slate-400 text-xs font-mono">
        Загрузка Vortex VPN...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#080B10] text-slate-100 flex flex-col overflow-hidden border border-white/[0.06]">
      <TitleBar
        status={status}
        traffic={traffic}
        onElevate={handleElevate}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelect={setActiveTab}
          status={status}
          profileCount={config.profiles.length}
          connectionCount={connections.connections.length}
        />

        <main className="flex-1 overflow-hidden bg-[#080B10] relative">
          {activeTab === "dashboard" && (
            <Dashboard
              config={config}
              status={status}
              traffic={traffic}
              trafficHistory={trafficHistory}
              onToggleConnect={handleToggleConnect}
              onSelectProfile={handleSelectProfile}
              onUpdateSettings={handleUpdateSettings}
              onElevate={handleElevate}
              onDownloadCore={handleDownloadCore}
              downloadingCore={downloadingCore}
            />
          )}

          {activeTab === "profiles" && (
            <Profiles
              config={config}
              onRefreshConfig={refreshConfig}
              onSelectProfile={handleSelectProfile}
              onSaveProfile={handleSaveProfile}
              onDeleteProfile={handleDeleteProfile}
            />
          )}

          {activeTab === "routing" && (
            <Routing
              settings={config.settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {activeTab === "connections" && (
            <Connections
              snapshot={connections}
              isConnected={status?.state === "connected"}
              onRefresh={refreshConnections}
            />
          )}

          {activeTab === "logs" && (
            <Logs logs={logs} onClear={handleClearLogs} />
          )}

          {activeTab === "settings" && (
            <Settings
              settings={config.settings}
              status={status}
              onUpdateSettings={handleUpdateSettings}
              onElevate={handleElevate}
              onDownloadCore={handleDownloadCore}
              downloadingCore={downloadingCore}
            />
          )}

          {/* Sleek floating toast notification */}
          {toast && (
            <div className="fixed bottom-4 right-4 z-50 max-w-md px-4 py-2.5 rounded-xl bg-[#151D2B] border border-white/[0.12] shadow-2xl text-xs text-slate-100">
              {toast}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
