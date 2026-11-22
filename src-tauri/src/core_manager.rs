use crate::models::{
    ActiveConnection, AppConfig, ConnectionState, ConnectionsSnapshot, IpInfo, LogEntry,
    PingResult, ProxyMode, TrafficStats, VlessProfile, VpnStatus,
};
use crate::singbox_config::build_singbox_config;
use crate::storage::{core_install_dir, load_config, runtime_singbox_config_path, save_config};
use crate::windows_sys_ops::{
    enable_system_proxy, is_elevated, restore_system_proxy, JobObjectGuard, SystemProxyBackup,
};
use chrono::Local;
use futures_util::StreamExt;
use serde_json::Value;
use std::collections::VecDeque;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio_tungstenite::connect_async;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAX_LOGS: usize = 600;

pub struct CoreState {
    pub config: AppConfig,
    pub state: ConnectionState,
    pub connected_since: Option<i64>,
    pub error_message: Option<String>,
    pub child: Option<Child>,
    #[cfg(windows)]
    pub job_guard: Option<JobObjectGuard>,
    pub sys_proxy_backup: SystemProxyBackup,
    pub logs: VecDeque<LogEntry>,
    pub total_up: u64,
    pub total_down: u64,
    pub traffic_task: Option<tokio::task::JoinHandle<()>>,
    pub monitor_task: Option<tokio::task::JoinHandle<()>>,
    pub core_version_cache: Option<String>,
}

pub struct VpnManager {
    pub inner: Arc<Mutex<CoreState>>,
    pub log_seq: Arc<AtomicU64>,
}

impl VpnManager {
    pub fn new() -> Self {
        let config = load_config();
        let inner = CoreState {
            config,
            state: ConnectionState::Disconnected,
            connected_since: None,
            error_message: None,
            child: None,
            #[cfg(windows)]
            job_guard: None,
            sys_proxy_backup: SystemProxyBackup::default(),
            logs: VecDeque::with_capacity(MAX_LOGS),
            total_up: 0,
            total_down: 0,
            traffic_task: None,
            monitor_task: None,
            core_version_cache: None,
        };
        Self {
            inner: Arc::new(Mutex::new(inner)),
            log_seq: Arc::new(AtomicU64::new(1)),
        }
    }

    pub fn locate_singbox(&self, app: &AppHandle) -> Option<PathBuf> {
        let mut candidates: Vec<PathBuf> = Vec::new();

        // 1. Bundled Tauri resource dir
        if let Ok(res_dir) = app.path().resource_dir() {
            candidates.push(res_dir.join("resources").join("sing-box.exe"));
            candidates.push(res_dir.join("sing-box.exe"));
        }

        // 2. Executable sibling dir & dev paths
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                candidates.push(dir.join("sing-box.exe"));
                candidates.push(dir.join("resources").join("sing-box.exe"));
                // When running `cargo run` from target/debug
                candidates.push(dir.join("..").join("..").join("resources").join("sing-box.exe"));
            }
        }

        // 3. AppData local core dir (downloaded core)
        candidates.push(core_install_dir().join("sing-box.exe"));

        // 4. Current working directory fallback
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("resources").join("sing-box.exe"));
            candidates.push(cwd.join("src-tauri").join("resources").join("sing-box.exe"));
            candidates.push(cwd.join("sing-box.exe"));
        }

        for path in candidates {
            if path.exists() && path.is_file() {
                return Some(path);
            }
        }
        None
    }

    pub async fn detect_core_version(&self, path: &PathBuf) -> Option<String> {
        let mut cmd = Command::new(path);
        cmd.arg("version")
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(out) = cmd.output().await {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(first_line) = text.lines().next() {
                return Some(first_line.trim().to_string());
            }
        }
        None
    }

    pub async fn push_log(
        inner: &Arc<Mutex<CoreState>>,
        log_seq: &Arc<AtomicU64>,
        app: &AppHandle,
        level: &str,
        message: String,
    ) {
        let entry = LogEntry {
            id: log_seq.fetch_add(1, Ordering::Relaxed),
            timestamp: Local::now().format("%H:%M:%S").to_string(),
            level: level.to_uppercase(),
            message,
        };
        {
            let mut st = inner.lock().await;
            if st.logs.len() >= MAX_LOGS {
                st.logs.pop_front();
            }
            st.logs.push_back(entry.clone());
        }
        let _ = app.emit("vpn://log", entry);
    }

    pub async fn get_status(&self, app: &AppHandle) -> VpnStatus {
        let core_path = self.locate_singbox(app);
        let mut core_version = {
            let st = self.inner.lock().await;
            st.core_version_cache.clone()
        };
        if core_version.is_none() {
            if let Some(ref p) = core_path {
                core_version = self.detect_core_version(p).await;
                let mut st = self.inner.lock().await;
                st.core_version_cache = core_version.clone();
            }
        }

        let st = self.inner.lock().await;
        let active_profile_tag = st.config.active_profile_id.as_ref().and_then(|id| {
            st.config
                .profiles
                .iter()
                .find(|p| &p.id == id)
                .map(|p| p.tag.clone())
        });

        VpnStatus {
            state: st.state,
            active_profile_id: st.config.active_profile_id.clone(),
            active_profile_tag,
            connected_since: st.connected_since,
            mode: st.config.settings.proxy_mode,
            error_message: st.error_message.clone(),
            is_admin: is_elevated(),
            core_installed: core_path.is_some(),
            core_version,
            core_path: core_path.map(|p| p.to_string_lossy().into_owned()),
        }
    }

    pub async fn emit_status(&self, app: &AppHandle) {
        let status = self.get_status(app).await;
        let _ = app.emit("vpn://status", status);
    }

    pub async fn connect(&self, app: &AppHandle) -> Result<VpnStatus, String> {
        // Stop any existing instance cleanly first
        let _ = self.disconnect(app).await;

        let core_path = self.locate_singbox(app).ok_or_else(|| {
            "Ядро sing-box.exe не найдено. Нажмите «Скачать ядро» в разделе Настройки или Логи."
                .to_string()
        })?;

        let (profile, settings) = {
            let st = self.inner.lock().await;
            let active_id = st
                .config
                .active_profile_id
                .clone()
                .ok_or_else(|| "Не выбран активный VPN-сервер".to_string())?;
            let profile = st
                .config
                .profiles
                .iter()
                .find(|p| p.id == active_id)
                .cloned()
                .ok_or_else(|| "Выбранный профиль не найден".to_string())?;
            (profile, st.config.settings.clone())
        };

        if settings.proxy_mode == ProxyMode::Tun && !is_elevated() {
            let msg = "Для режима TUN (маршрутизация всего трафика Windows) требуются права администратора. Нажмите «Запустить от администратора» или переключитесь на Системный прокси.".to_string();
            {
                let mut st = self.inner.lock().await;
                st.state = ConnectionState::Error;
                st.error_message = Some(msg.clone());
            }
            Self::push_log(&self.inner, &self.log_seq, app, "ERROR", msg.clone()).await;
            self.emit_status(app).await;
            return Err(msg);
        }

        // Mark connecting
        {
            let mut st = self.inner.lock().await;
            st.state = ConnectionState::Connecting;
            st.error_message = None;
            st.total_up = 0;
            st.total_down = 0;
        }
        self.emit_status(app).await;

        Self::push_log(
            &self.inner,
            &self.log_seq,
            app,
            "INFO",
            format!(
                "Подключение к «{}» ({}:{}) • Режим: {:?}",
                profile.tag, profile.server, profile.server_port, settings.proxy_mode
            ),
        )
        .await;

        // Generate sing-box 1.14 config
        let sb_json = build_singbox_config(&profile, &settings);
        let cfg_path = runtime_singbox_config_path();
        let pretty = serde_json::to_string_pretty(&sb_json)
            .map_err(|e| format!("Ошибка генерации конфигурации: {e}"))?;
        fs::write(&cfg_path, &pretty)
            .map_err(|e| format!("Не удалось записать singbox-runtime.json: {e}"))?;

        // Validate config with `sing-box check -c`
        let mut check_cmd = Command::new(&core_path);
        check_cmd
            .arg("check")
            .arg("-c")
            .arg(&cfg_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        check_cmd.creation_flags(CREATE_NO_WINDOW);

        let check_out = check_cmd
            .output()
            .await
            .map_err(|e| format!("Не удалось запустить sing-box check: {e}"))?;
        if !check_out.status.success() {
            let err_txt = format!(
                "{}{}",
                String::from_utf8_lossy(&check_out.stdout),
                String::from_utf8_lossy(&check_out.stderr)
            )
            .trim()
            .to_string();
            let msg = format!("Ошибка проверки конфига sing-box: {err_txt}");
            {
                let mut st = self.inner.lock().await;
                st.state = ConnectionState::Error;
                st.error_message = Some(msg.clone());
            }
            Self::push_log(&self.inner, &self.log_seq, app, "ERROR", msg.clone()).await;
            self.emit_status(app).await;
            return Err(msg);
        }

        // Launch sing-box run -c
        let mut run_cmd = Command::new(&core_path);
        run_cmd
            .arg("run")
            .arg("-c")
            .arg(&cfg_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(windows)]
        run_cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = run_cmd
            .spawn()
            .map_err(|e| format!("Не удалось запустить sing-box.exe: {e}"))?;

        // Assign to Windows Job Object so OS kernel cleans up sing-box on any crash/exit
        #[cfg(windows)]
        let job_guard = {
            let guard = JobObjectGuard::new();
            if let (Some(ref g), Some(pid)) = (&guard, child.id()) {
                g.assign_pid(pid);
            }
            guard
        };

        // Stream stdout & stderr logs to UI
        if let Some(stdout) = child.stdout.take() {
            let inner = self.inner.clone();
            let seq = self.log_seq.clone();
            let app_c = app.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let level = detect_log_level(&line);
                    Self::push_log(&inner, &seq, &app_c, level, strip_ansi(&line)).await;
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let inner = self.inner.clone();
            let seq = self.log_seq.clone();
            let app_c = app.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let level = detect_log_level(&line);
                    Self::push_log(&inner, &seq, &app_c, level, strip_ansi(&line)).await;
                }
            });
        }

        // Wait briefly & verify Clash API comes alive (up to 4 seconds)
        let clash_port = settings.clash_api_port;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(700))
            .no_proxy()
            .build()
            .unwrap();

        let mut started_ok = false;
        for _ in 0..16 {
            // Check if process exited prematurely
            if let Ok(Some(exit_status)) = child.try_wait() {
                let msg = format!(
                    "Ядро sing-box завершилось с кодом {:?}. Проверьте вкладку «Логи».",
                    exit_status.code()
                );
                {
                    let mut st = self.inner.lock().await;
                    st.state = ConnectionState::Error;
                    st.error_message = Some(msg.clone());
                }
                Self::push_log(&self.inner, &self.log_seq, app, "ERROR", msg.clone()).await;
                self.emit_status(app).await;
                return Err(msg);
            }

            if client
                .get(format!("http://127.0.0.1:{clash_port}/version"))
                .send()
                .await
                .is_ok()
            {
                started_ok = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }

        if !started_ok {
            let _ = child.kill().await;
            let msg = "Тайм-аут запуска sing-box API. Проверьте права администратора и логи.".to_string();
            {
                let mut st = self.inner.lock().await;
                st.state = ConnectionState::Error;
                st.error_message = Some(msg.clone());
            }
            Self::push_log(&self.inner, &self.log_seq, app, "ERROR", msg.clone()).await;
            self.emit_status(app).await;
            return Err(msg);
        }

        // Enable Windows System Proxy if in SystemProxy mode
        let sys_proxy_backup = if settings.proxy_mode == ProxyMode::SystemProxy {
            enable_system_proxy(settings.mixed_port)?
        } else {
            SystemProxyBackup::default()
        };

        // Start Clash API Traffic WebSocket stream
        let traffic_task = {
            let inner = self.inner.clone();
            let app_c = app.clone();
            tokio::spawn(async move {
                let ws_url = format!("ws://127.0.0.1:{clash_port}/traffic");
                if let Ok((mut ws_stream, _)) = connect_async(&ws_url).await {
                    while let Some(Ok(msg)) = ws_stream.next().await {
                        if let Ok(text) = msg.into_text() {
                            if let Ok(val) = serde_json::from_str::<Value>(&text) {
                                let up = val.get("up").and_then(|v| v.as_u64()).unwrap_or(0);
                                let down = val.get("down").and_then(|v| v.as_u64()).unwrap_or(0);
                                let (total_up, total_down) = {
                                    let mut st = inner.lock().await;
                                    if st.state != ConnectionState::Connected {
                                        break;
                                    }
                                    st.total_up += up;
                                    st.total_down += down;
                                    (st.total_up, st.total_down)
                                };
                                let stats = TrafficStats {
                                    up,
                                    down,
                                    total_up,
                                    total_down,
                                    timestamp: chrono::Utc::now().timestamp_millis(),
                                };
                                let _ = app_c.emit("vpn://traffic", stats);
                            }
                        }
                    }
                }
            })
        };

        // Store running process & mark Connected
        {
            let mut st = self.inner.lock().await;
            st.child = Some(child);
            #[cfg(windows)]
            {
                st.job_guard = job_guard;
            }
            st.sys_proxy_backup = sys_proxy_backup;
            st.state = ConnectionState::Connected;
            st.connected_since = Some(chrono::Utc::now().timestamp_millis());
            st.error_message = None;
            st.traffic_task = Some(traffic_task);
        }

        // Background watchdog detecting unexpected core death
        let monitor_task = {
            let inner = self.inner.clone();
            let seq = self.log_seq.clone();
            let app_c = app.clone();
            tokio::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    let exited = {
                        let mut st = inner.lock().await;
                        if st.state != ConnectionState::Connected {
                            break;
                        }
                        if let Some(ref mut ch) = st.child {
                            matches!(ch.try_wait(), Ok(Some(_)))
                        } else {
                            true
                        }
                    };
                    if exited {
                        {
                            let mut st = inner.lock().await;
                            restore_system_proxy(&mut st.sys_proxy_backup);
                            st.child = None;
                            #[cfg(windows)]
                            {
                                st.job_guard = None;
                            }
                            if let Some(t) = st.traffic_task.take() {
                                t.abort();
                            }
                            st.state = ConnectionState::Error;
                            st.connected_since = None;
                            st.error_message = Some(
                                "Ядро sing-box неожиданно остановилось. Проверьте логи."
                                    .to_string(),
                            );
                        }
                        Self::push_log(
                            &inner,
                            &seq,
                            &app_c,
                            "ERROR",
                            "Ядро sing-box неожиданно завершило работу".to_string(),
                        )
                        .await;
                        break;
                    }
                }
            })
        };

        {
            let mut st = self.inner.lock().await;
            st.monitor_task = Some(monitor_task);
        }

        Self::push_log(
            &self.inner,
            &self.log_seq,
            app,
            "INFO",
            format!(
                "Туннель активен! Весь трафик маршрутизируется через «{}»",
                profile.tag
            ),
        )
        .await;

        let status = self.get_status(app).await;
        let _ = app.emit("vpn://status", status.clone());
        Ok(status)
    }

    pub async fn disconnect(&self, app: &AppHandle) -> Result<VpnStatus, String> {
        let child_to_kill;
        let was_connected = {
            let mut st = self.inner.lock().await;
            let was = st.state == ConnectionState::Connected
                || st.state == ConnectionState::Connecting;
            if let Some(t) = st.traffic_task.take() {
                t.abort();
            }
            if let Some(t) = st.monitor_task.take() {
                t.abort();
            }
            restore_system_proxy(&mut st.sys_proxy_backup);
            child_to_kill = st.child.take();
            #[cfg(windows)]
            {
                st.job_guard = None;
            }
            st.state = ConnectionState::Disconnected;
            st.connected_since = None;
            st.error_message = None;
            was
        };

        if let Some(mut ch) = child_to_kill {
            let _ = ch.kill().await;
            let _ = ch.wait().await;
        }

        if was_connected {
            Self::push_log(
                &self.inner,
                &self.log_seq,
                app,
                "INFO",
                "VPN отключён. Сетевые маршруты восстановлены.".to_string(),
            )
            .await;
        }

        let status = self.get_status(app).await;
        let _ = app.emit("vpn://status", status.clone());
        Ok(status)
    }

    /// Synchronous emergency cleanup invoked when app exits.
    pub fn force_cleanup_sync(&self) {
        if let Ok(mut st) = self.inner.try_lock() {
            restore_system_proxy(&mut st.sys_proxy_backup);
            if let Some(t) = st.traffic_task.take() {
                t.abort();
            }
            if let Some(t) = st.monitor_task.take() {
                t.abort();
            }
            if let Some(mut ch) = st.child.take() {
                let _ = ch.start_kill();
            }
            #[cfg(windows)]
            {
                st.job_guard = None;
            }
            st.state = ConnectionState::Disconnected;
        }
    }

    pub async fn fetch_connections(&self) -> Result<ConnectionsSnapshot, String> {
        let (connected, port) = {
            let st = self.inner.lock().await;
            (
                st.state == ConnectionState::Connected,
                st.config.settings.clash_api_port,
            )
        };
        if !connected {
            return Ok(ConnectionsSnapshot {
                upload_total: 0,
                download_total: 0,
                connections: vec![],
            });
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .no_proxy()
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client
            .get(format!("http://127.0.0.1:{port}/connections"))
            .send()
            .await
            .map_err(|e| format!("API недоступен: {e}"))?;

        let val: Value = resp.json().await.map_err(|e| e.to_string())?;
        let upload_total = val.get("uploadTotal").and_then(|v| v.as_u64()).unwrap_or(0);
        let download_total = val
            .get("downloadTotal")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let mut connections = Vec::new();
        if let Some(arr) = val.get("connections").and_then(|v| v.as_array()) {
            for item in arr {
                let meta = item.get("metadata");
                let host = meta
                    .and_then(|m| m.get("host"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let dst_ip = meta
                    .and_then(|m| m.get("destinationIP"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let dst_port = meta
                    .and_then(|m| m.get("destinationPort"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let network = meta
                    .and_then(|m| m.get("network"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("tcp")
                    .to_uppercase();
                let process = meta
                    .and_then(|m| m.get("processPath"))
                    .and_then(|v| v.as_str())
                    .and_then(|p| p.rsplit(['\\', '/']).next())
                    .filter(|s| !s.is_empty())
                    .or_else(|| {
                        meta.and_then(|m| m.get("process"))
                            .and_then(|v| v.as_str())
                    })
                    .unwrap_or("system")
                    .to_string();

                let chains = item
                    .get("chains")
                    .and_then(|v| v.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                connections.push(ActiveConnection {
                    id: item
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    host: if host.is_empty() { dst_ip.clone() } else { host },
                    destination_ip: dst_ip,
                    destination_port: dst_port,
                    network,
                    process,
                    rule: item
                        .get("rule")
                        .and_then(|v| v.as_str())
                        .unwrap_or("final")
                        .to_string(),
                    chains,
                    upload: item.get("upload").and_then(|v| v.as_u64()).unwrap_or(0),
                    download: item.get("download").and_then(|v| v.as_u64()).unwrap_or(0),
                    start: item
                        .get("start")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                });
            }
        }

        Ok(ConnectionsSnapshot {
            upload_total,
            download_total,
            connections,
        })
    }

    pub async fn close_connection(&self, id: Option<String>) -> Result<(), String> {
        let port = {
            let st = self.inner.lock().await;
            st.config.settings.clash_api_port
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .no_proxy()
            .build()
            .map_err(|e| e.to_string())?;

        let url = match id {
            Some(cid) => format!("http://127.0.0.1:{port}/connections/{cid}"),
            None => format!("http://127.0.0.1:{port}/connections"),
        };
        client
            .delete(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn ping_profile(&self, profile: &VlessProfile) -> PingResult {
        let addr = format!("{}:{}", profile.server, profile.server_port);
        let start = Instant::now();
        match tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(&addr)).await {
            Ok(Ok(_stream)) => {
                let ms = start.elapsed().as_millis() as u64;
                let mut st = self.inner.lock().await;
                if let Some(p) = st.config.profiles.iter_mut().find(|x| x.id == profile.id) {
                    p.latency_ms = Some(ms);
                    p.last_checked = Some(Local::now().format("%H:%M:%S").to_string());
                }
                let _ = save_config(&st.config);
                PingResult {
                    profile_id: profile.id.clone(),
                    latency_ms: Some(ms),
                    error: None,
                }
            }
            Ok(Err(e)) => PingResult {
                profile_id: profile.id.clone(),
                latency_ms: None,
                error: Some(e.to_string()),
            },
            Err(_) => PingResult {
                profile_id: profile.id.clone(),
                latency_ms: None,
                error: Some("Тайм-аут (>3000ms)".to_string()),
            },
        }
    }

    pub async fn check_external_ip(&self) -> Result<IpInfo, String> {
        let (connected, mixed_port) = {
            let st = self.inner.lock().await;
            (
                st.state == ConnectionState::Connected,
                st.config.settings.mixed_port,
            )
        };

        let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(6));
        if connected {
            let proxy = reqwest::Proxy::all(format!("http://127.0.0.1:{mixed_port}"))
                .map_err(|e| e.to_string())?;
            builder = builder.proxy(proxy);
        }
        let client = builder.build().map_err(|e| e.to_string())?;

        let start = Instant::now();
        // Try ipwho.is first (no API key, clean JSON with country/city/ISP)
        if let Ok(resp) = client.get("https://ipwho.is/").send().await {
            if let Ok(val) = resp.json::<Value>().await {
                if val.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let latency = start.elapsed().as_millis() as u64;
                    return Ok(IpInfo {
                        ip: val
                            .get("ip")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown")
                            .to_string(),
                        country: val
                            .get("country")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        country_code: val
                            .get("country_code")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        city: val
                            .get("city")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        org: val
                            .get("connection")
                            .and_then(|c| c.get("isp"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        latency_ms: latency,
                    });
                }
            }
        }

        // Fallback to ipinfo.io
        let start2 = Instant::now();
        let resp = client
            .get("https://ipinfo.io/json")
            .send()
            .await
            .map_err(|e| format!("Не удалось определить внешний IP: {e}"))?;
        let val: Value = resp.json().await.map_err(|e| e.to_string())?;
        let latency = start2.elapsed().as_millis() as u64;

        Ok(IpInfo {
            ip: val
                .get("ip")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            country: val
                .get("country")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            country_code: val
                .get("country")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            city: val
                .get("city")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            org: val
                .get("org")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            latency_ms: latency,
        })
    }

    pub async fn download_latest_core(&self, app: &AppHandle) -> Result<String, String> {
        Self::push_log(
            &self.inner,
            &self.log_seq,
            app,
            "INFO",
            "Поиск последнего релиза sing-box на GitHub...".to_string(),
        )
        .await;

        let client = reqwest::Client::builder()
            .user_agent("VortexVPN/1.0")
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;

        let release: Value = client
            .get("https://api.github.com/repos/SagerNet/sing-box/releases/latest")
            .send()
            .await
            .map_err(|e| format!("Ошибка запроса GitHub API: {e}"))?
            .json()
            .await
            .map_err(|e| format!("Ошибка разбора ответа GitHub: {e}"))?;

        let tag = release
            .get("tag_name")
            .and_then(|v| v.as_str())
            .unwrap_or("latest")
            .to_string();

        let assets = release
            .get("assets")
            .and_then(|v| v.as_array())
            .ok_or("Не найдены файлы релиза")?;

        let download_url = assets
            .iter()
            .find_map(|a| {
                let name = a.get("name")?.as_str()?;
                if name.ends_with("windows-amd64.zip") && !name.contains("legacy") {
                    a.get("browser_download_url")?.as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
            .ok_or("Не найден архив windows-amd64.zip")?;

        Self::push_log(
            &self.inner,
            &self.log_seq,
            app,
            "INFO",
            format!("Скачивание sing-box {tag}..."),
        )
        .await;

        let bytes = client
            .get(&download_url)
            .send()
            .await
            .map_err(|e| format!("Ошибка скачивания: {e}"))?
            .bytes()
            .await
            .map_err(|e| format!("Ошибка чтения архива: {e}"))?;

        let cursor = std::io::Cursor::new(bytes);
        let mut archive =
            zip::ZipArchive::new(cursor).map_err(|e| format!("Ошибка открытия ZIP: {e}"))?;

        let dest_path = core_install_dir().join("sing-box.exe");
        let mut extracted = false;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            if file.name().ends_with("sing-box.exe") {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                fs::write(&dest_path, buf)
                    .map_err(|e| format!("Ошибка сохранения sing-box.exe: {e}"))?;
                extracted = true;
                break;
            }
        }

        if !extracted {
            return Err("В архиве не найден sing-box.exe".to_string());
        }

        let ver = self.detect_core_version(&dest_path).await;
        {
            let mut st = self.inner.lock().await;
            st.core_version_cache = ver.clone();
        }
        Self::push_log(
            &self.inner,
            &self.log_seq,
            app,
            "INFO",
            format!(
                "Ядро успешно установлено: {}",
                ver.as_deref().unwrap_or(&tag)
            ),
        )
        .await;
        self.emit_status(app).await;
        Ok(ver.unwrap_or(tag))
    }
}

fn detect_log_level(line: &str) -> &'static str {
    let up = line.to_uppercase();
    if up.contains("FATAL") || up.contains("ERROR") || up.contains("ERRO") {
        "ERROR"
    } else if up.contains("WARN") {
        "WARN"
    } else if up.contains("DEBUG") || up.contains("TRACE") {
        "DEBUG"
    } else {
        "INFO"
    }
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for ch in chars.by_ref() {
                    if ch.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}
