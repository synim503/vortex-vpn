import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  AppSettings,
  ConnectionsSnapshot,
  IpInfo,
  LogEntry,
  PingResult,
  VlessProfile,
  VpnStatus,
} from "../types/vpn";

export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const DEMO_CONFIG: AppConfig = {
  activeProfileId: "demo-fi-0",
  profiles: [
    {
      id: "demo-fi-0",
      tag: "Reality-FI § 0",
      server: "203.0.113.42",
      serverPort: 8446,
      uuid: "00000000-0000-4000-8000-000000000001",
      flow: "xtls-rprx-vision",
      tlsEnabled: true,
      serverName: "www.apple.com",
      utlsEnabled: true,
      utlsFingerprint: "chrome",
      realityEnabled: true,
      realityPublicKey: "DemoPublicKeyFI0123456789abcdefABCDEF123456",
      realityShortId: "0123456789abcdef",
      packetEncoding: "xudp",
      latencyMs: 38,
      lastChecked: "16:30:12",
    },
    {
      id: "demo-nl-1",
      tag: "Reality-NL § Amsterdam",
      server: "198.51.100.18",
      serverPort: 443,
      uuid: "8a12b34c-d56e-4f78-9012-000000000001",
      flow: "xtls-rprx-vision",
      tlsEnabled: true,
      serverName: "www.microsoft.com",
      utlsEnabled: true,
      utlsFingerprint: "chrome",
      realityEnabled: true,
      realityPublicKey: "DemoPublicKeyNL9876543210abcdefABCDEF123456",
      realityShortId: "a1b2c3d4",
      packetEncoding: "xudp",
      latencyMs: 54,
      lastChecked: "16:30:12",
    },
    {
      id: "demo-de-2",
      tag: "Reality-DE § Frankfurt",
      server: "192.0.2.77",
      serverPort: 8443,
      uuid: "5f98e76d-c43b-4a21-8765-000000000002",
      flow: "xtls-rprx-vision",
      tlsEnabled: true,
      serverName: "www.cloudflare.com",
      utlsEnabled: true,
      utlsFingerprint: "firefox",
      realityEnabled: true,
      realityPublicKey: "DemoPublicKeyDE11223344556677889900aabbccdd",
      realityShortId: "f0e1d2c3",
      packetEncoding: "xudp",
      latencyMs: 62,
      lastChecked: "16:30:12",
    },
  ],
  settings: {
    proxyMode: "tun",
    dnsPreset: "adGuard",
    customDns: "1.1.1.1",
    tunMtu: 1500,
    tunStack: "mixed",
    strictRoute: true,
    ipv6Mode: "block",
    mixedPort: 10808,
    clashApiPort: 19090,
    minimizeToTray: true,
    autoConnect: false,
    logLevel: "info",
    routing: {
      mode: "global",
      bypassLan: true,
      blockQuic: false,
      bypassDomains: ["gosuslugi.ru", ".ru"],
      bypassIps: ["192.168.1.0/24"],
      bypassProcesses: ["steam.exe", "qbittorrent.exe"],
    },
  },
};

const DEMO_CONNECTIONS: ConnectionsSnapshot = {
  uploadTotal: 14_820_400,
  downloadTotal: 189_450_200,
  connections: [
    {
      id: "c1",
      host: "api.github.com",
      destinationIp: "140.82.121.6",
      destinationPort: "443",
      network: "TCP",
      process: "chrome.exe",
      rule: "final",
      chains: ["proxy"],
      upload: 48200,
      download: 1_240_500,
      start: "16:31:02",
    },
    {
      id: "c2",
      host: "rr3---sn-4g5e6ns7.googlevideo.com",
      destinationIp: "142.250.185.14",
      destinationPort: "443",
      network: "TCP",
      process: "chrome.exe",
      rule: "final",
      chains: ["proxy"],
      upload: 124_000,
      download: 42_850_000,
      start: "16:30:44",
    },
    {
      id: "c3",
      host: "gateway.discord.gg",
      destinationIp: "162.159.135.234",
      destinationPort: "443",
      network: "TCP",
      process: "Discord.exe",
      rule: "final",
      chains: ["proxy"],
      upload: 892_100,
      download: 3_412_800,
      start: "16:28:11",
    },
    {
      id: "c4",
      host: "149.154.167.91",
      destinationIp: "149.154.167.91",
      destinationPort: "443",
      network: "TCP",
      process: "Telegram.exe",
      rule: "final",
      chains: ["proxy"],
      upload: 312_000,
      download: 5_980_000,
      start: "16:25:00",
    },
    {
      id: "c5",
      host: "store.steampowered.com",
      destinationIp: "23.200.140.12",
      destinationPort: "443",
      network: "TCP",
      process: "steam.exe",
      rule: "process_name",
      chains: ["direct"],
      upload: 19_400,
      download: 840_200,
      start: "16:29:55",
    },
    {
      id: "c6",
      host: "1.1.1.1",
      destinationIp: "1.1.1.1",
      destinationPort: "443",
      network: "UDP",
      process: "svchost.exe",
      rule: "hijack-dns",
      chains: ["proxy"],
      upload: 8_200,
      download: 24_600,
      start: "16:25:01",
    },
  ],
};

const DEMO_LOGS: LogEntry[] = [
  { id: 1, timestamp: "16:25:00", level: "INFO", message: "Подключение к «Reality-FI § 0» (203.0.113.42:8446) • Режим: Tun" },
  { id: 2, timestamp: "16:25:00", level: "INFO", message: "inbound/tun[tun-in]: started at VortexTUN (MTU 1500, stack=mixed, auto_route=true, strict_route=true)" },
  { id: 3, timestamp: "16:25:00", level: "INFO", message: "inbound/mixed[mixed-in]: tcp server started at 127.0.0.1:10808" },
  { id: 4, timestamp: "16:25:01", level: "INFO", message: "clash-api: restful api listening at 127.0.0.1:19090" },
  { id: 5, timestamp: "16:25:01", level: "INFO", message: "outbound/vless[proxy]: VLESS+REALITY+xtls-rprx-vision (uTLS chrome, xudp) handshake verified" },
  { id: 6, timestamp: "16:25:01", level: "INFO", message: "Туннель активен! Весь трафик маршрутизируется через «Reality-FI § 0»" },
  { id: 7, timestamp: "16:25:02", level: "INFO", message: "router: match process_name=steam.exe => direct" },
  { id: 8, timestamp: "16:25:03", level: "INFO", message: "outbound/vless[proxy]: inbound connection to api.github.com:443 [chrome.exe]" },
  { id: 9, timestamp: "16:25:04", level: "WARN", message: "router: blocked IPv6 leak attempt [::/0] => reject" },
];

let demoConfigState: AppConfig = structuredClone(DEMO_CONFIG);
let demoConnected = true;

const demoStatus = (): VpnStatus => ({
  state: demoConnected ? "connected" : "disconnected",
  activeProfileId: demoConfigState.activeProfileId,
  activeProfileTag:
    demoConfigState.profiles.find((p) => p.id === demoConfigState.activeProfileId)?.tag ?? null,
  connectedSince: demoConnected ? Date.now() - 872_000 : null,
  mode: demoConfigState.settings.proxyMode,
  errorMessage: null,
  isAdmin: true,
  coreInstalled: true,
  coreVersion: "sing-box version 1.14.4",
  corePath: "C:\\Program Files\\VortexVPN\\sing-box.exe",
});

export const api = {
  getConfig: () =>
    isTauriRuntime() ? invoke<AppConfig>("get_config") : Promise.resolve(structuredClone(demoConfigState)),
  getStatus: () =>
    isTauriRuntime() ? invoke<VpnStatus>("get_status") : Promise.resolve(demoStatus()),
  connectVpn: () => {
    if (isTauriRuntime()) return invoke<VpnStatus>("connect_vpn");
    demoConnected = true;
    return Promise.resolve(demoStatus());
  },
  disconnectVpn: () => {
    if (isTauriRuntime()) return invoke<VpnStatus>("disconnect_vpn");
    demoConnected = false;
    return Promise.resolve(demoStatus());
  },
  selectProfile: (profileId: string) => {
    if (isTauriRuntime()) return invoke<AppConfig>("select_profile", { profileId });
    demoConfigState = { ...demoConfigState, activeProfileId: profileId };
    return Promise.resolve(structuredClone(demoConfigState));
  },
  saveProfile: (profile: VlessProfile) => {
    if (isTauriRuntime()) return invoke<AppConfig>("save_profile", { profile });
    const exists = demoConfigState.profiles.some((p) => p.id === profile.id);
    demoConfigState = {
      ...demoConfigState,
      profiles: exists
        ? demoConfigState.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...demoConfigState.profiles, { ...profile, id: profile.id || String(Date.now()) }],
    };
    return Promise.resolve(structuredClone(demoConfigState));
  },
  deleteProfile: (profileId: string) => {
    if (isTauriRuntime()) return invoke<AppConfig>("delete_profile", { profileId });
    demoConfigState = {
      ...demoConfigState,
      profiles: demoConfigState.profiles.filter((p) => p.id !== profileId),
    };
    return Promise.resolve(structuredClone(demoConfigState));
  },
  importProfiles: (input: string) =>
    isTauriRuntime() ? invoke<VlessProfile[]>("import_profiles", { input }) : Promise.resolve([]),
  exportProfile: (profileId: string, format: "json" | "uri") =>
    isTauriRuntime()
      ? invoke<string>("export_profile", { profileId, format })
      : Promise.resolve("vless://demo"),
  updateSettings: (settings: AppSettings, reconnectIfActive = true) => {
    if (isTauriRuntime()) return invoke<AppConfig>("update_settings", { settings, reconnectIfActive });
    demoConfigState = { ...demoConfigState, settings };
    return Promise.resolve(structuredClone(demoConfigState));
  },
  previewSingboxConfig: () =>
    isTauriRuntime()
      ? invoke<string>("preview_singbox_config")
      : Promise.resolve(JSON.stringify({ mode: "preview" }, null, 2)),
  pingProfile: (profileId: string) =>
    isTauriRuntime()
      ? invoke<PingResult>("ping_profile", { profileId })
      : Promise.resolve({ profileId, latencyMs: 38, error: null }),
  pingAllProfiles: () =>
    isTauriRuntime() ? invoke<PingResult[]>("ping_all_profiles") : Promise.resolve([]),
  checkExternalIp: () =>
    isTauriRuntime()
      ? invoke<IpInfo>("check_external_ip")
      : Promise.resolve({
          ip: "185.220.101.42",
          country: "Finland",
          countryCode: "FI",
          city: "Helsinki",
          org: "Hetzner Online GmbH",
          latencyMs: 41,
        }),
  getConnections: () =>
    isTauriRuntime()
      ? invoke<ConnectionsSnapshot>("get_connections")
      : Promise.resolve(DEMO_CONNECTIONS),
  closeConnection: (id?: string) =>
    isTauriRuntime() ? invoke<void>("close_connection", { id: id ?? null }) : Promise.resolve(),
  getLogs: () =>
    isTauriRuntime() ? invoke<LogEntry[]>("get_logs") : Promise.resolve(DEMO_LOGS),
  clearLogs: () => (isTauriRuntime() ? invoke<void>("clear_logs") : Promise.resolve()),
  getRunningProcesses: () =>
    isTauriRuntime()
      ? invoke<string[]>("get_running_processes")
      : Promise.resolve(["chrome.exe", "Discord.exe", "steam.exe", "Telegram.exe", "Code.exe"]),
  restartAsAdmin: () =>
    isTauriRuntime() ? invoke<void>("restart_as_admin") : Promise.resolve(),
  downloadCore: () =>
    isTauriRuntime() ? invoke<string>("download_core") : Promise.resolve("sing-box version 1.14.4"),
  quitApp: () => (isTauriRuntime() ? invoke<void>("quit_app") : Promise.resolve()),
};

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val < 10 && idx > 0 ? val.toFixed(2) : val < 100 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
