use crate::models::VlessProfile;
use serde_json::{json, Value};
use url::Url;
use uuid::Uuid;

/// Parses sing-box JSON (`{ "outbounds": [...] }`), a single VLESS outbound JSON,
/// or one/multiple `vless://` share links.
pub fn parse_import_input(input: &str) -> Result<Vec<VlessProfile>, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Входные данные пусты".to_string());
    }

    // 1. Try JSON format first
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        let val: Value = serde_json::from_str(trimmed)
            .map_err(|e| format!("Ошибка разбора JSON: {e}"))?;

        let mut results = Vec::new();
        if let Some(outbounds) = val.get("outbounds").and_then(|v| v.as_array()) {
            for item in outbounds {
                if item.get("type").and_then(|t| t.as_str()) == Some("vless") {
                    results.push(parse_singbox_outbound(item)?);
                }
            }
        } else if let Some(arr) = val.as_array() {
            for item in arr {
                if item.get("type").and_then(|t| t.as_str()) == Some("vless") {
                    results.push(parse_singbox_outbound(item)?);
                }
            }
        } else if val.get("type").and_then(|t| t.as_str()) == Some("vless") {
            results.push(parse_singbox_outbound(&val)?);
        }

        if results.is_empty() {
            return Err("В JSON не найдено ни одного VLESS outbound-профиля".to_string());
        }
        return Ok(results);
    }

    // 2. Try vless:// share URI(s) (line by line)
    let mut results = Vec::new();
    for line in trimmed.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if line.starts_with("vless://") {
            results.push(parse_vless_uri(line)?);
        }
    }

    if results.is_empty() {
        return Err(
            "Нераспознанный формат. Вставьте JSON-конфиг sing-box или ссылку vless://..."
                .to_string(),
        );
    }
    Ok(results)
}

fn parse_singbox_outbound(val: &Value) -> Result<VlessProfile, String> {
    let server = val
        .get("server")
        .and_then(|v| v.as_str())
        .ok_or("Отсутствует поле 'server'")?
        .to_string();

    let server_port = val
        .get("server_port")
        .and_then(|v| v.as_u64())
        .ok_or("Отсутствует поле 'server_port'")? as u16;

    let uuid = val
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("Отсутствует поле 'uuid'")?
        .to_string();

    let tag = val
        .get("tag")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("VLESS {}:{}", server, server_port));

    let flow = val
        .get("flow")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let packet_encoding = val
        .get("packet_encoding")
        .and_then(|v| v.as_str())
        .unwrap_or("xudp")
        .to_string();

    let tls = val.get("tls");
    let tls_enabled = tls
        .and_then(|t| t.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let server_name = tls
        .and_then(|t| t.get("server_name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let utls = tls.and_then(|t| t.get("utls"));
    let utls_enabled = utls
        .and_then(|u| u.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let utls_fingerprint = utls
        .and_then(|u| u.get("fingerprint"))
        .and_then(|v| v.as_str())
        .unwrap_or("chrome")
        .to_string();

    let reality = tls.and_then(|t| t.get("reality"));
    let reality_enabled = reality
        .and_then(|r| r.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let reality_public_key = reality
        .and_then(|r| r.get("public_key"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let reality_short_id = reality
        .and_then(|r| r.get("short_id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(VlessProfile {
        id: Uuid::new_v4().to_string(),
        tag,
        server,
        server_port,
        uuid,
        flow,
        tls_enabled,
        server_name,
        utls_enabled,
        utls_fingerprint,
        reality_enabled,
        reality_public_key,
        reality_short_id,
        packet_encoding,
        latency_ms: None,
        last_checked: None,
    })
}

fn parse_vless_uri(uri: &str) -> Result<VlessProfile, String> {
    let parsed = Url::parse(uri).map_err(|e| format!("Некорректная vless:// ссылка: {e}"))?;
    let uuid = parsed.username().to_string();
    if uuid.is_empty() {
        return Err("В ссылке vless:// отсутствует UUID".to_string());
    }
    let server = parsed
        .host_str()
        .ok_or("В ссылке vless:// отсутствует хост")?
        .to_string();
    let server_port = parsed.port().unwrap_or(443);

    let mut flow = String::new();
    let mut security = String::new();
    let mut sni = String::new();
    let mut fp = "chrome".to_string();
    let mut pbk = String::new();
    let mut sid = String::new();
    let mut packet_encoding = "xudp".to_string();

    for (k, v) in parsed.query_pairs() {
        match k.as_ref() {
            "flow" => flow = v.into_owned(),
            "security" => security = v.into_owned(),
            "sni" => sni = v.into_owned(),
            "fp" => fp = v.into_owned(),
            "pbk" => pbk = v.into_owned(),
            "sid" => sid = v.into_owned(),
            "packetEncoding" | "packet_encoding" => packet_encoding = v.into_owned(),
            _ => {}
        }
    }

    let reality_enabled = security.eq_ignore_ascii_case("reality") || !pbk.is_empty();
    let tls_enabled = reality_enabled || security.eq_ignore_ascii_case("tls");
    let utls_enabled = tls_enabled && !fp.is_empty();

    let tag = parsed
        .fragment()
        .map(|f| percent_decode(f))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("VLESS {}:{}", server, server_port));

    Ok(VlessProfile {
        id: Uuid::new_v4().to_string(),
        tag,
        server,
        server_port,
        uuid,
        flow,
        tls_enabled,
        server_name: sni,
        utls_enabled,
        utls_fingerprint: fp,
        reality_enabled,
        reality_public_key: pbk,
        reality_short_id: sid,
        packet_encoding,
        latency_ms: None,
        last_checked: None,
    })
}

fn percent_decode(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    let raw = s.as_bytes();
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' && i + 2 < raw.len() {
            if let (Some(h1), Some(h2)) = (hex_val(raw[i + 1]), hex_val(raw[i + 2])) {
                bytes.push((h1 << 4) | h2);
                i += 3;
                continue;
            }
        } else if raw[i] == b'+' {
            bytes.push(b' ');
            i += 1;
            continue;
        }
        bytes.push(raw[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub fn export_singbox_outbound_json(p: &VlessProfile) -> String {
    let mut outbound = json!({
        "type": "vless",
        "tag": p.tag,
        "server": p.server,
        "server_port": p.server_port,
        "uuid": p.uuid,
    });

    if !p.flow.trim().is_empty() {
        outbound["flow"] = json!(p.flow);
    }

    if p.tls_enabled {
        let mut tls = json!({
            "enabled": true,
            "server_name": p.server_name,
        });
        if p.utls_enabled {
            tls["utls"] = json!({
                "enabled": true,
                "fingerprint": p.utls_fingerprint,
            });
        }
        if p.reality_enabled {
            tls["reality"] = json!({
                "enabled": true,
                "public_key": p.reality_public_key,
                "short_id": p.reality_short_id,
            });
        }
        outbound["tls"] = tls;
    }

    if !p.packet_encoding.trim().is_empty() {
        outbound["packet_encoding"] = json!(p.packet_encoding);
    }

    let root = json!({
        "outbounds": [outbound]
    });

    serde_json::to_string_pretty(&root).unwrap_or_default()
}

pub fn export_vless_uri(p: &VlessProfile) -> String {
    let mut url = Url::parse(&format!(
        "vless://{}@{}:{}",
        p.uuid, p.server, p.server_port
    ))
    .unwrap_or_else(|_| Url::parse("vless://invalid@127.0.0.1:443").unwrap());

    {
        let mut q = url.query_pairs_mut();
        q.append_pair("encryption", "none");
        if !p.flow.is_empty() {
            q.append_pair("flow", &p.flow);
        }
        if p.reality_enabled {
            q.append_pair("security", "reality");
            if !p.reality_public_key.is_empty() {
                q.append_pair("pbk", &p.reality_public_key);
            }
            if !p.reality_short_id.is_empty() {
                q.append_pair("sid", &p.reality_short_id);
            }
        } else if p.tls_enabled {
            q.append_pair("security", "tls");
        }
        if !p.server_name.is_empty() {
            q.append_pair("sni", &p.server_name);
        }
        if p.utls_enabled && !p.utls_fingerprint.is_empty() {
            q.append_pair("fp", &p.utls_fingerprint);
        }
        if !p.packet_encoding.is_empty() {
            q.append_pair("packetEncoding", &p.packet_encoding);
        }
        q.append_pair("type", "tcp");
    }

    url.set_fragment(Some(&p.tag));
    url.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::AppSettings;
    use crate::singbox_config::build_singbox_config;

    #[test]
    fn parses_reality_json_and_roundtrips_uri() {
        let input = r#"{
          "outbounds": [
            {
              "type": "vless",
              "tag": "Reality-FI § 0",
              "server": "203.0.113.42",
              "server_port": 8446,
              "uuid": "00000000-0000-4000-8000-000000000001",
              "flow": "xtls-rprx-vision",
              "tls": {
                "enabled": true,
                "server_name": "www.apple.com",
                "utls": {
                  "enabled": true,
                  "fingerprint": "chrome"
                },
                "reality": {
                  "enabled": true,
                  "public_key": "DemoPublicKey0123456789abcdefABCDEF12345678",
                  "short_id": "0123456789abcdef"
                }
              },
              "packet_encoding": "xudp"
            }
          ]
        }"#;

        let parsed = parse_import_input(input).expect("should parse reality JSON");
        assert_eq!(parsed.len(), 1);
        let p = &parsed[0];
        assert_eq!(p.tag, "Reality-FI § 0");
        assert_eq!(p.server, "203.0.113.42");
        assert_eq!(p.server_port, 8446);
        assert_eq!(p.uuid, "00000000-0000-4000-8000-000000000001");
        assert_eq!(p.flow, "xtls-rprx-vision");
        assert!(p.tls_enabled);
        assert_eq!(p.server_name, "www.apple.com");
        assert!(p.utls_enabled);
        assert_eq!(p.utls_fingerprint, "chrome");
        assert!(p.reality_enabled);
        assert_eq!(p.reality_public_key, "DemoPublicKey0123456789abcdefABCDEF12345678");
        assert_eq!(p.reality_short_id, "0123456789abcdef");
        assert_eq!(p.packet_encoding, "xudp");

        // Round-trip via vless:// share URI
        let uri = export_vless_uri(p);
        let reparsed = parse_import_input(&uri).expect("should parse exported vless URI");
        assert_eq!(reparsed.len(), 1);
        assert_eq!(reparsed[0].server, p.server);
        assert_eq!(reparsed[0].server_port, p.server_port);
        assert_eq!(reparsed[0].uuid, p.uuid);
        assert_eq!(reparsed[0].flow, p.flow);
        assert_eq!(reparsed[0].reality_public_key, p.reality_public_key);
        assert_eq!(reparsed[0].reality_short_id, p.reality_short_id);
        assert_eq!(reparsed[0].packet_encoding, p.packet_encoding);

        // Verify sing-box config structure
        let cfg = build_singbox_config(p, &AppSettings::default());
        assert_eq!(cfg["route"]["final"], "proxy");
        assert_eq!(cfg["inbounds"][0]["type"], "tun");
        assert_eq!(cfg["inbounds"][0]["auto_route"], true);
        assert_eq!(cfg["outbounds"][0]["flow"], "xtls-rprx-vision");
        assert_eq!(cfg["outbounds"][0]["packet_encoding"], "xudp");
    }
}

