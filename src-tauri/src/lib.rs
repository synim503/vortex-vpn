mod commands;
mod core_manager;
mod models;
mod parser;
mod singbox_config;
mod storage;
mod windows_sys_ops;

use core_manager::VpnManager;
use models::ConnectionState;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let manager = Arc::new(VpnManager::new());
    let manager_for_exit = manager.clone();
    let manager_for_setup = manager.clone();

    let app = tauri::Builder::default()
        .manage(manager)
        .setup(move |app| {
            // Setup System Tray
            let show_item = MenuItem::with_id(app, "show", "Открыть Vortex VPN", true, None::<&str>)?;
            let toggle_item =
                MenuItem::with_id(app, "toggle", "Подключить / Отключить", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &toggle_item, &quit_item])?;

            let mgr_tray = manager_for_setup.clone();
            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Vortex VPN — VLESS Reality")
                .on_menu_event(move |app_handle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "toggle" => {
                        let app_c = app_handle.clone();
                        let m = mgr_tray.clone();
                        tauri::async_runtime::spawn(async move {
                            let is_conn = {
                                let st = m.inner.lock().await;
                                st.state == ConnectionState::Connected
                                    || st.state == ConnectionState::Connecting
                            };
                            if is_conn {
                                let _ = m.disconnect(&app_c).await;
                            } else {
                                let _ = m.connect(&app_c).await;
                            }
                        });
                    }
                    "quit" => {
                        let app_c = app_handle.clone();
                        let m = mgr_tray.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = m.disconnect(&app_c).await;
                            app_c.exit(0);
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _ = tray_builder.build(app)?;

            // Auto-connect if enabled in settings
            let auto_mgr = manager_for_setup.clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let should_auto = {
                    let st = auto_mgr.inner.lock().await;
                    st.config.settings.auto_connect
                };
                if should_auto {
                    let _ = auto_mgr.connect(&app_handle).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle().clone();
                let mgr = app_handle.state::<Arc<VpnManager>>().inner().clone();
                let minimize_to_tray = mgr
                    .inner
                    .try_lock()
                    .map(|st| st.config.settings.minimize_to_tray)
                    .unwrap_or(true);

                if minimize_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    mgr.force_cleanup_sync();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::get_status,
            commands::connect_vpn,
            commands::disconnect_vpn,
            commands::select_profile,
            commands::save_profile,
            commands::delete_profile,
            commands::import_profiles,
            commands::export_profile,
            commands::update_settings,
            commands::preview_singbox_config,
            commands::ping_profile,
            commands::ping_all_profiles,
            commands::check_external_ip,
            commands::get_connections,
            commands::close_connection,
            commands::get_logs,
            commands::clear_logs,
            commands::get_running_processes,
            commands::restart_as_admin,
            commands::download_core,
            commands::quit_app,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Vortex VPN");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit | RunEvent::ExitRequested { .. } = event {
            manager_for_exit.force_cleanup_sync();
        }
    });
}
