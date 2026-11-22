export interface VlessProfile {
  id: string;
  tag: string;
  server: string;
  serverPort: number;
  uuid: string;
  flow: string;
  tlsEnabled: boolean;
  serverName: string;
  utlsEnabled: boolean;
  utlsFingerprint: string;
  realityEnabled: boolean;
  realityPublicKey: string;
  realityShortId: string;
  packetEncoding: string;
  latencyMs?: number | null;
  lastChecked?: string | null;
}

export type ProxyMode = "tun" | "systemProxy";
export type RoutingMode = "global" | "bypassRu" | "custom";
export type DnsPreset = "cloudflare" | "google" | "adGuard" | "quad9" | "custom";
export type Ipv6Mode = "block" | "route" | "direct";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface RoutingConfig {
  mode: RoutingMode;
  bypassLan: boolean;
  blockQuic: boolean;
  bypassDomains: string[];
  bypassIps: string[];
  bypassProcesses: string[];
}

export interface AppSettings {
  proxyMode: ProxyMode;
  dnsPreset: DnsPreset;
  customDns: string;
  tunMtu: number;
  tunStack: string;
  strictRoute: boolean;
  ipv6Mode: Ipv6Mode;
  mixedPort: number;
  clashApiPort: number;
  minimizeToTray: boolean;
  autoConnect: boolean;
  logLevel: string;
  routing: RoutingConfig;
}

export interface AppConfig {
  activeProfileId: string | null;
  profiles: VlessProfile[];
  settings: AppSettings;
}

export interface VpnStatus {
  state: ConnectionState;
  activeProfileId: string | null;
  activeProfileTag: string | null;
  connectedSince: number | null;
  mode: ProxyMode;
  errorMessage: string | null;
  isAdmin: boolean;
  coreInstalled: boolean;
  coreVersion: string | null;
  corePath: string | null;
}

export interface TrafficStats {
  up: number;
  down: number;
  totalUp: number;
  totalDown: number;
  timestamp: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  message: string;
}

export interface ActiveConnection {
  id: string;
  host: string;
  destinationIp: string;
  destinationPort: string;
  network: string;
  process: string;
  rule: string;
  chains: string[];
  upload: number;
  download: number;
  start: string;
}

export interface ConnectionsSnapshot {
  uploadTotal: number;
  downloadTotal: number;
  connections: ActiveConnection[];
}

export interface IpInfo {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  org: string;
  latencyMs: number;
}

export interface PingResult {
  profileId: string;
  latencyMs: number | null;
  error: string | null;
}

export type NavTab = "dashboard" | "profiles" | "routing" | "connections" | "logs" | "settings";
