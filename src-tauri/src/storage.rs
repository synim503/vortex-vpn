use crate::models::{AppConfig, AppSettings, VlessProfile};
use directories::ProjectDirs;
use std::fs;
use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    if let Some(proj) = ProjectDirs::from("com", "VortexVPN", "VortexVPN") {
        let dir = proj.data_local_dir().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        dir
    } else {
        let mut dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        dir.push("vortex-data");
        let _ = fs::create_dir_all(&dir);
        dir
    }
}

pub fn config_path() -> PathBuf {
    data_dir().join("config.json")
}

pub fn runtime_singbox_config_path() -> PathBuf {
    data_dir().join("singbox-runtime.json")
}

pub fn core_install_dir() -> PathBuf {
    let dir = data_dir().join("core");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn default_profile() -> VlessProfile {
    VlessProfile {
        id: "default-reality-example".to_string(),
        tag: "Reality-FI § Example".to_string(),
        server: "203.0.113.42".to_string(),
        server_port: 8446,
        uuid: "00000000-0000-4000-8000-000000000001".to_string(),
        flow: "xtls-rprx-vision".to_string(),
        tls_enabled: true,
        server_name: "www.apple.com".to_string(),
        utls_enabled: true,
        utls_fingerprint: "chrome".to_string(),
        reality_enabled: true,
        reality_public_key: "YOUR_REALITY_PUBLIC_KEY".to_string(),
        reality_short_id: "0123456789abcdef".to_string(),
        packet_encoding: "xudp".to_string(),
        latency_ms: None,
        last_checked: None,
    }
}

pub fn default_config() -> AppConfig {
    let profile = default_profile();
    let active_id = profile.id.clone();
    AppConfig {
        active_profile_id: Some(active_id),
        profiles: vec![profile],
        settings: AppSettings::default(),
    }
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(mut cfg) = serde_json::from_str::<AppConfig>(&content) {
                if cfg.profiles.is_empty() {
                    let p = default_profile();
                    cfg.active_profile_id = Some(p.id.clone());
                    cfg.profiles.push(p);
                }
                if cfg.active_profile_id.is_none() {
                    cfg.active_profile_id = cfg.profiles.first().map(|p| p.id.clone());
                }
                return cfg;
            }
        }
    }
    let cfg = default_config();
    let _ = save_config(&cfg);
    cfg
}

pub fn save_config(cfg: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;
    Ok(())
}
