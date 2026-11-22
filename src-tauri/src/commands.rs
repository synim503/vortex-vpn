use crate::core_manager::VpnManager;
use crate::models::{
    AppConfig, AppSettings, ConnectionState, ConnectionsSnapshot, IpInfo, LogEntry, PingResult,
    VlessProfile, VpnStatus,
};
use crate::parser::{export_singbox_outbound_json, export_vless_uri, parse_import_input};
use crate::singbox_config::build_singbox_config;
use crate::storage::save_config;
use crate::windows_sys_ops::{list_running_processes, relaunch_as_admin};
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
pub async fn get_config(mgr: State<'_, Arc<VpnManager>>) -> Result<AppConfig, String> {
    let st = mgr.inner.lock().await;
    Ok(st.config.clone())
}

#[tauri::command]
pub async fn get_status(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<VpnStatus, String> {
    Ok(mgr.get_status(&app).await)
}

#[tauri::command]
pub async fn connect_vpn(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<VpnStatus, String> {
    mgr.connect(&app).await
}

#[tauri::command]
pub async fn disconnect_vpn(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<VpnStatus, String> {
    mgr.disconnect(&app).await
}

#[tauri::command]
pub async fn select_profile(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
    profile_id: String,
) -> Result<AppConfig, String> {
    let was_connected = {
        let mut st = mgr.inner.lock().await;
        if !st.config.profiles.iter().any(|p| p.id == profile_id) {
            return Err("Профиль не найден".to_string());
        }
        st.config.active_profile_id = Some(profile_id);
        save_config(&st.config)?;
        st.state == ConnectionState::Connected
    };

    if was_connected {
        let _ = mgr.connect(&app).await;
    } else {
        mgr.emit_status(&app).await;
    }

    let st = mgr.inner.lock().await;
    Ok(st.config.clone())
}

#[tauri::command]
pub async fn save_profile(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
    mut profile: VlessProfile,
) -> Result<AppConfig, String> {
    let needs_reconnect = {
        let mut st = mgr.inner.lock().await;
        if profile.id.trim().is_empty() {
            profile.id = Uuid::new_v4().to_string();
        }
        if let Some(existing) = st.config.profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile.clone();
        } else {
            st.config.profiles.push(profile.clone());
            if st.config.active_profile_id.is_none() {
                st.config.active_profile_id = Some(profile.id.clone());
            }
        }
        save_config(&st.config)?;
        st.state == ConnectionState::Connected
            && st.config.active_profile_id.as_deref() == Some(profile.id.as_str())
    };

    if needs_reconnect {
        let _ = mgr.connect(&app).await;
    } else {
        mgr.emit_status(&app).await;
    }

    let st = mgr.inner.lock().await;
    Ok(st.config.clone())
}

#[tauri::command]
pub async fn delete_profile(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
    profile_id: String,
) -> Result<AppConfig, String> {
    let mut should_disconnect = false;
    {
        let mut st = mgr.inner.lock().await;
        st.config.profiles.retain(|p| p.id != profile_id);
        if st.config.active_profile_id.as_deref() == Some(profile_id.as_str()) {
            st.config.active_profile_id = st.config.profiles.first().map(|p| p.id.clone());
            if st.state == ConnectionState::Connected {
                should_disconnect = true;
            }
        }
        save_config(&st.config)?;
    }

    if should_disconnect {
        let _ = mgr.disconnect(&app).await;
    } else {
        mgr.emit_status(&app).await;
    }

    let st = mgr.inner.lock().await;
    Ok(st.config.clone())
}

#[tauri::command]
pub async fn import_profiles(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
    input: String,
) -> Result<Vec<VlessProfile>, String> {
    let imported = parse_import_input(&input)?;
    {
        let mut st = mgr.inner.lock().await;
        for p in &imported {
            st.config.profiles.push(p.clone());
        }
        if st.config.active_profile_id.is_none() {
            st.config.active_profile_id = imported.first().map(|p| p.id.clone());
        }
        save_config(&st.config)?;
    }
    VpnManager::push_log(
        &mgr.inner,
        &mgr.log_seq,
        &app,
        "INFO",
        format!("Импортировано профилей: {}", imported.len()),
    )
    .await;
    mgr.emit_status(&app).await;
    Ok(imported)
}

#[tauri::command]
pub async fn export_profile(
    mgr: State<'_, Arc<VpnManager>>,
    profile_id: String,
    format: String,
) -> Result<String, String> {
    let st = mgr.inner.lock().await;
    let p = st
        .config
        .profiles
        .iter()
        .find(|x| x.id == profile_id)
        .ok_or("Профиль не найден")?;
    match format.as_str() {
        "uri" | "vless" => Ok(export_vless_uri(p)),
        _ => Ok(export_singbox_outbound_json(p)),
    }
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
    settings: AppSettings,
    reconnect_if_active: Option<bool>,
) -> Result<AppConfig, String> {
    let was_connected = {
        let mut st = mgr.inner.lock().await;
        st.config.settings = settings;
        save_config(&st.config)?;
        st.state == ConnectionState::Connected
    };

    if was_connected && reconnect_if_active.unwrap_or(true) {
        let _ = mgr.connect(&app).await;
    } else {
        mgr.emit_status(&app).await;
    }

    let st = mgr.inner.lock().await;
    Ok(st.config.clone())
}

#[tauri::command]
pub async fn preview_singbox_config(mgr: State<'_, Arc<VpnManager>>) -> Result<String, String> {
    let st = mgr.inner.lock().await;
    let active_id = st
        .config
        .active_profile_id
        .as_deref()
        .ok_or("Нет активного профиля")?;
    let profile = st
        .config
        .profiles
        .iter()
        .find(|p| p.id == active_id)
        .ok_or("Активный профиль не найден")?;
    let cfg = build_singbox_config(profile, &st.config.settings);
    serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ping_profile(
    mgr: State<'_, Arc<VpnManager>>,
    profile_id: String,
) -> Result<PingResult, String> {
    let profile = {
        let st = mgr.inner.lock().await;
        st.config
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .cloned()
            .ok_or("Профиль не найден")?
    };
    Ok(mgr.ping_profile(&profile).await)
}

#[tauri::command]
pub async fn ping_all_profiles(mgr: State<'_, Arc<VpnManager>>) -> Result<Vec<PingResult>, String> {
    let profiles = {
        let st = mgr.inner.lock().await;
        st.config.profiles.clone()
    };
    let mut handles = Vec::new();
    for p in profiles {
        let m = mgr.inner().clone();
        handles.push(tokio::spawn(async move { m.ping_profile(&p).await }));
    }
    let mut results = Vec::new();
    for h in handles {
        if let Ok(r) = h.await {
            results.push(r);
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn check_external_ip(mgr: State<'_, Arc<VpnManager>>) -> Result<IpInfo, String> {
    mgr.check_external_ip().await
}

#[tauri::command]
pub async fn get_connections(
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<ConnectionsSnapshot, String> {
    mgr.fetch_connections().await
}

#[tauri::command]
pub async fn close_connection(
    mgr: State<'_, Arc<VpnManager>>,
    id: Option<String>,
) -> Result<(), String> {
    mgr.close_connection(id).await
}

#[tauri::command]
pub async fn get_logs(mgr: State<'_, Arc<VpnManager>>) -> Result<Vec<LogEntry>, String> {
    let st = mgr.inner.lock().await;
    Ok(st.logs.iter().cloned().collect())
}

#[tauri::command]
pub async fn clear_logs(mgr: State<'_, Arc<VpnManager>>) -> Result<(), String> {
    let mut st = mgr.inner.lock().await;
    st.logs.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_running_processes() -> Result<Vec<String>, String> {
    Ok(list_running_processes())
}

#[tauri::command]
pub async fn restart_as_admin(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<(), String> {
    let _ = mgr.disconnect(&app).await;
    relaunch_as_admin()?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn download_core(
    app: AppHandle,
    mgr: State<'_, Arc<VpnManager>>,
) -> Result<String, String> {
    mgr.download_latest_core(&app).await
}

#[tauri::command]
pub async fn quit_app(app: AppHandle, mgr: State<'_, Arc<VpnManager>>) -> Result<(), String> {
    let _ = mgr.disconnect(&app).await;
    app.exit(0);
    Ok(())
}
