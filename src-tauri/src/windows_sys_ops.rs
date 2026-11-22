use std::collections::BTreeSet;

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::ptr::{null, null_mut};
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
#[cfg(windows)]
use windows_sys::Win32::Networking::WinInet::{
    InternetSetOptionW, INTERNET_OPTION_REFRESH, INTERNET_OPTION_SETTINGS_CHANGED,
};
#[cfg(windows)]
use windows_sys::Win32::Security::{
    GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
};
#[cfg(windows)]
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_ALL_ACCESS,
};
#[cfg(windows)]
use windows_sys::Win32::UI::Shell::ShellExecuteW;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

/// Returns true if the current Windows process has Administrator privileges (required for TUN mode).
#[cfg(windows)]
pub fn is_elevated() -> bool {
    unsafe {
        let mut token: HANDLE = null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut ret_len: u32 = 0;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut ret_len,
        );
        CloseHandle(token);
        ok != 0 && elevation.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    true
}

/// Relaunches the current application with Windows UAC Administrator elevation.
#[cfg(windows)]
pub fn relaunch_as_admin() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("Не удалось найти путь exe: {e}"))?;
    let exe_w: Vec<u16> = OsStr::new(exe.as_os_str())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let verb_w: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let res = ShellExecuteW(
            null_mut(),
            verb_w.as_ptr(),
            exe_w.as_ptr(),
            null(),
            null(),
            SW_SHOWNORMAL,
        );
        if (res as isize) <= 32 {
            return Err("Пользователь отменил запрос UAC или не удалось перезапустить с правами администратора".to_string());
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn relaunch_as_admin() -> Result<(), String> {
    Err("UAC поддерживается только на Windows".to_string())
}

/// Windows Job Object wrapper ensuring `sing-box.exe` is ALWAYS killed by the OS kernel
/// if the parent Vortex VPN process exits or crashes, preventing orphaned Wintun routes.
#[cfg(windows)]
pub struct JobObjectGuard {
    handle: HANDLE,
}

#[cfg(windows)]
unsafe impl Send for JobObjectGuard {}
#[cfg(windows)]
unsafe impl Sync for JobObjectGuard {}

#[cfg(windows)]
impl JobObjectGuard {
    pub fn new() -> Option<Self> {
        unsafe {
            let job = CreateJobObjectW(null(), null());
            if job.is_null() {
                return None;
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &mut info as *mut _ as *mut _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                CloseHandle(job);
                return None;
            }
            Some(Self { handle: job })
        }
    }

    pub fn assign_pid(&self, pid: u32) {
        unsafe {
            let proc_handle = OpenProcess(PROCESS_ALL_ACCESS, 0, pid);
            if !proc_handle.is_null() {
                let _ = AssignProcessToJobObject(self.handle, proc_handle);
                CloseHandle(proc_handle);
            }
        }
    }
}

#[cfg(windows)]
impl Drop for JobObjectGuard {
    fn drop(&mut self) {
        unsafe {
            if !self.handle.is_null() {
                CloseHandle(self.handle);
            }
        }
    }
}

/// Backup of previous Windows System Proxy settings so they are cleanly restored on disconnect.
#[derive(Debug, Clone, Default)]
pub struct SystemProxyBackup {
    pub enable: u32,
    pub server: Option<String>,
    pub r#override: Option<String>,
    pub active: bool,
}

#[cfg(windows)]
pub fn enable_system_proxy(port: u16) -> Result<SystemProxyBackup, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey_with_flags(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            KEY_READ | KEY_WRITE,
        )
        .map_err(|e| format!("Не удалось открыть реестр системного прокси: {e}"))?;

    let prev_enable: u32 = key.get_value("ProxyEnable").unwrap_or(0);
    let prev_server: Option<String> = key.get_value("ProxyServer").ok();
    let prev_override: Option<String> = key.get_value("ProxyOverride").ok();

    let proxy_addr = format!("127.0.0.1:{port}");
    let override_list =
        "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>";

    key.set_value("ProxyEnable", &1u32)
        .map_err(|e| format!("Ошибка установки ProxyEnable: {e}"))?;
    key.set_value("ProxyServer", &proxy_addr)
        .map_err(|e| format!("Ошибка установки ProxyServer: {e}"))?;
    key.set_value("ProxyOverride", &override_list)
        .map_err(|e| format!("Ошибка установки ProxyOverride: {e}"))?;

    notify_wininet_proxy_changed();

    Ok(SystemProxyBackup {
        enable: prev_enable,
        server: prev_server,
        r#override: prev_override,
        active: true,
    })
}

#[cfg(windows)]
pub fn restore_system_proxy(backup: &mut SystemProxyBackup) {
    if !backup.active {
        return;
    }
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey_with_flags(
        "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        KEY_WRITE,
    ) {
        let _ = key.set_value("ProxyEnable", &backup.enable);
        if let Some(ref srv) = backup.server {
            let _ = key.set_value("ProxyServer", srv);
        } else {
            let _ = key.delete_value("ProxyServer");
        }
        if let Some(ref ovr) = backup.r#override {
            let _ = key.set_value("ProxyOverride", ovr);
        } else {
            let _ = key.delete_value("ProxyOverride");
        }
        notify_wininet_proxy_changed();
    }
    backup.active = false;
}

#[cfg(windows)]
fn notify_wininet_proxy_changed() {
    unsafe {
        InternetSetOptionW(null_mut(), INTERNET_OPTION_SETTINGS_CHANGED, null_mut(), 0);
        InternetSetOptionW(null_mut(), INTERNET_OPTION_REFRESH, null_mut(), 0);
    }
}

#[cfg(not(windows))]
pub fn enable_system_proxy(_port: u16) -> Result<SystemProxyBackup, String> {
    Ok(SystemProxyBackup::default())
}

#[cfg(not(windows))]
pub fn restore_system_proxy(_backup: &mut SystemProxyBackup) {}

/// Lists unique running `.exe` process names on Windows for Split Tunneling picker.
#[cfg(windows)]
pub fn list_running_processes() -> Vec<String> {
    let mut names = BTreeSet::new();
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE || snap.is_null() {
            return vec![];
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if name.to_lowercase().ends_with(".exe")
                    && !name.eq_ignore_ascii_case("svchost.exe")
                    && !name.eq_ignore_ascii_case("System")
                    && !name.eq_ignore_ascii_case("sing-box.exe")
                {
                    names.insert(name);
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
    }
    names.into_iter().collect()
}

#[cfg(not(windows))]
pub fn list_running_processes() -> Vec<String> {
    vec![]
}
