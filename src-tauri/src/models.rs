use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VlessProfile {
    pub id: String,
    pub tag: String,
    pub server: String,
    pub server_port: u16,
    pub uuid: String,
    pub flow: String,
    pub tls_enabled: bool,
    pub server_name: String,
    pub utls_enabled: bool,
    pub utls_fingerprint: String,
    pub reality_enabled: bool,
    pub reality_public_key: String,
    pub reality_short_id: String,
    pub packet_encoding: String,
    #[serde(default)]
    pub latency_ms: Option<u64>,
    #[serde(default)]
    pub last_checked: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProxyMode {
    Tun,
    SystemProxy,
}

impl Default for ProxyMode {
    fn default() -> Self {
        ProxyMode::Tun
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RoutingMode {
    Global,
    BypassRu,
    Custom,
}

impl Default for RoutingMode {
    fn default() -> Self {
        RoutingMode::Global
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DnsPreset {
    Cloudflare,
    Google,
    AdGuard,
    Quad9,
    Custom,
}

impl Default for DnsPreset {
    fn default() -> Self {
        DnsPreset::Cloudflare
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Ipv6Mode {
    Block,
    Route,
    Direct,
}

impl Default for Ipv6Mode {
    fn default() -> Self {
        Ipv6Mode::Block
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutingConfig {
    #[serde(default)]
    pub mode: RoutingMode,
    #[serde(default = "default_true")]
    pub bypass_lan: bool,
    #[serde(default)]
    pub block_quic: bool,
    #[serde(default)]
    pub bypass_domains: Vec<String>,
    #[serde(default)]
    pub bypass_ips: Vec<String>,
    #[serde(default)]
    pub bypass_processes: Vec<String>,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        Self {
            mode: RoutingMode::Global,
            bypass_lan: true,
            block_quic: false,
            bypass_domains: vec![],
            bypass_ips: vec![],
            bypass_processes: vec![],
        }
    }
}

fn default_true() -> bool {
    true
}
fn default_mtu() -> u32 {
    1500
}
fn default_stack() -> String {
    "mixed".to_string()
}
fn default_mixed_port() -> u16 {
    10808
}
fn default_clash_port() -> u16 {
    19090
}
fn default_log_level() -> String {
    "info".to_string()
}
fn default_custom_dns() -> String {
    "1.1.1.1".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub proxy_mode: ProxyMode,
    #[serde(default)]
    pub dns_preset: DnsPreset,
    #[serde(default = "default_custom_dns")]
    pub custom_dns: String,
    #[serde(default = "default_mtu")]
    pub tun_mtu: u32,
    #[serde(default = "default_stack")]
    pub tun_stack: String,
    #[serde(default = "default_true")]
    pub strict_route: bool,
    #[serde(default)]
    pub ipv6_mode: Ipv6Mode,
    #[serde(default = "default_mixed_port")]
    pub mixed_port: u16,
    #[serde(default = "default_clash_port")]
    pub clash_api_port: u16,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    #[serde(default)]
    pub auto_connect: bool,
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default)]
    pub routing: RoutingConfig,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            proxy_mode: ProxyMode::Tun,
            dns_preset: DnsPreset::Cloudflare,
            custom_dns: default_custom_dns(),
            tun_mtu: default_mtu(),
            tun_stack: default_stack(),
            strict_route: true,
            ipv6_mode: Ipv6Mode::Block,
            mixed_port: default_mixed_port(),
            clash_api_port: default_clash_port(),
            minimize_to_tray: true,
            auto_connect: false,
            log_level: default_log_level(),
            routing: RoutingConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub active_profile_id: Option<String>,
    pub profiles: Vec<VlessProfile>,
    pub settings: AppSettings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnStatus {
    pub state: ConnectionState,
    pub active_profile_id: Option<String>,
    pub active_profile_tag: Option<String>,
    pub connected_since: Option<i64>,
    pub mode: ProxyMode,
    pub error_message: Option<String>,
    pub is_admin: bool,
    pub core_installed: bool,
    pub core_version: Option<String>,
    pub core_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficStats {
    pub up: u64,
    pub down: u64,
    pub total_up: u64,
    pub total_down: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: u64,
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveConnection {
    pub id: String,
    pub host: String,
    pub destination_ip: String,
    pub destination_port: String,
    pub network: String,
    pub process: String,
    pub rule: String,
    pub chains: Vec<String>,
    pub upload: u64,
    pub download: u64,
    pub start: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsSnapshot {
    pub upload_total: u64,
    pub download_total: u64,
    pub connections: Vec<ActiveConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpInfo {
    pub ip: String,
    pub country: String,
    pub country_code: String,
    pub city: String,
    pub org: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    pub profile_id: String,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}
