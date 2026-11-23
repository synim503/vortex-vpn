use crate::models::{AppSettings, DnsPreset, Ipv6Mode, ProxyMode, RoutingMode, VlessProfile};
use serde_json::{json, Value};

const RU_DEFAULT_SUFFIXES: &[&str] = &[
    ".ru",
    ".su",
    ".xn--p1ai", // .рф
    "yandex.com",
    "vk.com",
    "vk.me",
    "ozon.com",
    "wildberries.org",
    "sberbank.com",
    "gosuslugi.ru",
];

pub fn build_singbox_config(profile: &VlessProfile, settings: &AppSettings) -> Value {
    // 1. Remote DoH DNS server (routed strictly via VPN proxy to prevent DNS leaks)
    let dns_remote = match settings.dns_preset {
        DnsPreset::Cloudflare => json!({
            "type": "https",
            "tag": "dns_remote",
            "server": "1.1.1.1",
            "server_port": 443,
            "path": "/dns-query",
            "detour": "proxy"
        }),
        DnsPreset::Google => json!({
            "type": "https",
            "tag": "dns_remote",
            "server": "8.8.8.8",
            "server_port": 443,
            "path": "/dns-query",
            "detour": "proxy"
        }),
        DnsPreset::AdGuard => json!({
            "type": "https",
            "tag": "dns_remote",
            "server": "94.140.14.14",
            "server_port": 443,
            "path": "/dns-query",
            "tls": {
                "enabled": true,
                "server_name": "dns.adguard-dns.com"
            },
            "detour": "proxy"
        }),
        DnsPreset::Quad9 => json!({
            "type": "https",
            "tag": "dns_remote",
            "server": "9.9.9.9",
            "server_port": 443,
            "path": "/dns-query",
            "detour": "proxy"
        }),
        DnsPreset::Custom => {
            let custom = settings.custom_dns.trim();
            if custom.starts_with("https://") {
                if let Ok(parsed) = url::Url::parse(custom) {
                    let host = parsed.host_str().unwrap_or("1.1.1.1").to_string();
                    let port = parsed.port().unwrap_or(443);
                    let path = if parsed.path().is_empty() || parsed.path() == "/" {
                        "/dns-query"
                    } else {
                        parsed.path()
                    };
                    json!({
                        "type": "https",
                        "tag": "dns_remote",
                        "server": host,
                        "server_port": port,
                        "path": path,
                        "detour": "proxy"
                    })
                } else {
                    json!({
                        "type": "udp",
                        "tag": "dns_remote",
                        "server": "1.1.1.1",
                        "server_port": 53,
                        "detour": "proxy"
                    })
                }
            } else {
                let server = if custom.is_empty() { "1.1.1.1" } else { custom };
                json!({
                    "type": "udp",
                    "tag": "dns_remote",
                    "server": server,
                    "server_port": 53,
                    "detour": "proxy"
                })
            }
        }
    };

    // Direct bootstrap DNS for server hostname resolution & bypassed domains
    let dns_direct = json!({
        "type": "udp",
        "tag": "dns_direct",
        "server": "1.1.1.1",
        "server_port": 53
    });

    // OS-native resolver for localhost, *.localhost, *.local and hosts file entries
    let dns_local = json!({
        "type": "local",
        "tag": "dns_local"
    });

    // Collect bypass domains based on routing mode
    let mut bypass_domains: Vec<String> = Vec::new();
    if settings.routing.mode == RoutingMode::BypassRu {
        for d in RU_DEFAULT_SUFFIXES {
            bypass_domains.push((*d).to_string());
        }
    }
    if settings.routing.mode != RoutingMode::Global {
        for d in &settings.routing.bypass_domains {
            let clean = d.trim().to_lowercase();
            if !clean.is_empty() && !bypass_domains.contains(&clean) {
                bypass_domains.push(clean);
            }
        }
    }

    let mut dns_rules: Vec<Value> = vec![json!({
        "domain": ["localhost"],
        "domain_suffix": [".localhost", ".local"],
        "server": "dns_local"
    })];
    if !bypass_domains.is_empty() {
        dns_rules.push(json!({
            "domain_suffix": bypass_domains,
            "server": "dns_direct"
        }));
    }

    let dns_strategy = match settings.ipv6_mode {
        Ipv6Mode::Block => "ipv4_only",
        Ipv6Mode::Route | Ipv6Mode::Direct => "prefer_ipv4",
    };

    // 2. Inbounds: Full Windows Wintun TUN (when Tun mode) + Local Mixed SOCKS5/HTTP proxy
    let mut inbounds: Vec<Value> = Vec::new();

    if settings.proxy_mode == ProxyMode::Tun {
        let addresses = match settings.ipv6_mode {
            Ipv6Mode::Route => json!(["172.19.0.1/30", "fdfe:dcba:9876::1/126"]),
            Ipv6Mode::Block => json!(["172.19.0.1/30", "fdfe:dcba:9876::1/126"]),
            Ipv6Mode::Direct => json!(["172.19.0.1/30"]),
        };

        inbounds.push(json!({
            "type": "tun",
            "tag": "tun-in",
            "interface_name": "VortexTUN",
            "address": addresses,
            "mtu": settings.tun_mtu.clamp(1280, 9000),
            "auto_route": true,
            "strict_route": settings.strict_route,
            "stack": settings.tun_stack
        }));
    }

    inbounds.push(json!({
        "type": "mixed",
        "tag": "mixed-in",
        "listen": "127.0.0.1",
        "listen_port": settings.mixed_port
    }));

    // 3. Outbounds: VLESS Reality Vision XUDP + Direct
    let mut vless_outbound = json!({
        "type": "vless",
        "tag": "proxy",
        "server": profile.server,
        "server_port": profile.server_port,
        "uuid": profile.uuid
    });

    if !profile.flow.trim().is_empty() {
        vless_outbound["flow"] = json!(profile.flow.trim());
    }

    if profile.tls_enabled {
        let mut tls = json!({
            "enabled": true,
            "server_name": profile.server_name.trim()
        });
        if profile.utls_enabled {
            tls["utls"] = json!({
                "enabled": true,
                "fingerprint": if profile.utls_fingerprint.trim().is_empty() {
                    "chrome"
                } else {
                    profile.utls_fingerprint.trim()
                }
            });
        }
        if profile.reality_enabled {
            tls["reality"] = json!({
                "enabled": true,
                "public_key": profile.reality_public_key.trim(),
                "short_id": profile.reality_short_id.trim()
            });
        }
        vless_outbound["tls"] = tls;
    }

    if !profile.packet_encoding.trim().is_empty() {
        vless_outbound["packet_encoding"] = json!(profile.packet_encoding.trim());
    }

    let outbounds = vec![
        vless_outbound,
        json!({
            "type": "direct",
            "tag": "direct"
        }),
    ];

    // 4. Routing Rules
    let mut route_rules: Vec<Value> = vec![
        json!({ "action": "sniff" }),
        json!({ "protocol": "dns", "action": "hijack-dns" }),
        // Always bypass loopback (IPv4 & IPv6) and localhost regardless of LAN/IPv6 settings
        json!({
            "ip_cidr": ["127.0.0.0/8", "::1/128"],
            "outbound": "direct"
        }),
        json!({
            "domain": ["localhost"],
            "domain_suffix": [".localhost"],
            "outbound": "direct"
        }),
    ];

    // Bypass private LAN addresses (192.168.x.x, 10.x.x.x, link-local, etc.) before public IPv6 block
    if settings.routing.bypass_lan {
        route_rules.push(json!({
            "ip_is_private": true,
            "outbound": "direct"
        }));
    }

    // Prevent public IPv6 leaks when IPv6 is set to Block
    if settings.ipv6_mode == Ipv6Mode::Block {
        route_rules.push(json!({
            "ip_cidr": ["::/0"],
            "action": "reject"
        }));
    }

    // Optional QUIC block (useful when UDP/443 causes browser stalls or DPI noise)
    if settings.routing.block_quic {
        route_rules.push(json!({
            "protocol": "quic",
            "action": "reject"
        }));
    }

    // Process split tunneling (works in all modes if user explicitly added apps to bypass)
    let clean_procs: Vec<String> = settings
        .routing
        .bypass_processes
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if !clean_procs.is_empty() {
        route_rules.push(json!({
            "process_name": clean_procs,
            "outbound": "direct"
        }));
    }

    // Domain & IP bypass rules (active in BypassRu / Custom modes)
    if !bypass_domains.is_empty() {
        route_rules.push(json!({
            "domain_suffix": bypass_domains,
            "outbound": "direct"
        }));
    }

    if settings.routing.mode != RoutingMode::Global {
        let clean_ips: Vec<String> = settings
            .routing
            .bypass_ips
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !clean_ips.is_empty() {
            route_rules.push(json!({
                "ip_cidr": clean_ips,
                "outbound": "direct"
            }));
        }
    }

    json!({
        "log": {
            "level": settings.log_level,
            "timestamp": true
        },
        "dns": {
            "servers": [dns_remote, dns_direct, dns_local],
            "rules": dns_rules,
            "final": "dns_remote",
            "strategy": dns_strategy
        },
        "inbounds": inbounds,
        "outbounds": outbounds,
        "route": {
            "rules": route_rules,
            "auto_detect_interface": true,
            "default_domain_resolver": "dns_direct",
            "final": "proxy"
        },
        "experimental": {
            "clash_api": {
                "external_controller": format!("127.0.0.1:{}", settings.clash_api_port)
            }
        }
    })
}
