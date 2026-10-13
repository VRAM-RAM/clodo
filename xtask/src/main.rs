use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::Duration;

fn main() {
    let mut args = std::env::args().skip(1);
    let sub = args.next().unwrap_or_default();
    match sub.as_str() {
        "wasm" => cmd_build_wasm(),
        "check" => cmd_check(),
        "serve" => {
            let port = args.next().and_then(|p| p.parse().ok()).unwrap_or(8000);
            if let Err(e) = serve(port) {
                eprintln!("serve: {e}");
                std::process::exit(1);
            }
        }
        "host" => {
            let port = args.next().and_then(|p| p.parse().ok()).unwrap_or(8000);
            if let Err(e) = host(port) {
                eprintln!("host: {e}");
                std::process::exit(1);
            }
        }
        "clean" => cmd_clean(),
        _ => usage(),
    }
}

fn cmd_build_wasm() {
    let status = Command::new("wasm-pack")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if !status {
        eprintln!("wasm-pack is not installed.");
        eprintln!("Install it with one of:");
        eprintln!("    brew install wasm-pack");
        eprintln!("    cargo install wasm-pack");
        std::process::exit(1);
    }
    run(
        Command::new("wasm-pack").args(["build", "--target", "web", "--out-dir", "pkg"]),
        "wasm-pack build",
    );
    println!("OK -> pkg/ is ready. Serve it with: cargo xtask serve");
}

fn cmd_check() {
    run(Command::new("cargo").arg("check"), "cargo check (host)");
    run(
        Command::new("cargo").args(["check", "--target", "wasm32-unknown-unknown"]),
        "cargo check (wasm32)",
    );
    println!("check OK (host + wasm32)");
}

fn cmd_clean() {
    if Path::new("pkg").exists() {
        fs::remove_dir_all("pkg").expect("remove pkg/");
    }
    println!("pkg/ removed");
}

fn usage() {
    println!(
        "cargo xtask <command>\n\ncommands:\n  wasm     build the Rust core to WebAssembly (pkg/)\n  check    run cargo check for the host and wasm32 targets\n  serve    run a static dev server (default :8000)\n  host     run a static dev server binding 0.0.0.0 (default :8000)\n  clean    remove pkg/ (deployment is handled by GitHub Actions on push)"
    );
}

fn run(command: &mut Command, label: &str) {
    let status = command.status().unwrap_or_else(|e| panic!("{label}: {e}"));
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }
}

fn serve(port: u16) -> std::io::Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let root = std::env::current_dir()?;
    println!(
        "Clodo — serving {} on http://127.0.0.1:{port}/",
        root.display()
    );
    println!("Press Ctrl+C to stop.");
    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                let _ = handle(s, &root);
            }
            Err(e) => eprintln!("connection error: {e}"),
        }
    }
    Ok(())
}

fn host(port: u16) -> std::io::Result<()> {
    let listener = TcpListener::bind(("0.0.0.0", port))?;
    let root = std::env::current_dir()?;
    println!(
        "Clodo — hosting {} on http://0.0.0.0:{port}/",
        root.display()
    );
    println!("Press Ctrl+C to stop.");
    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                let _ = handle(s, &root);
            }
            Err(e) => eprintln!("connection error: {e}"),
        }
    }
    Ok(())
}

fn handle(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf)?;
    let text = String::from_utf8_lossy(&buf[..n]);
    let request_line = text.lines().next().unwrap_or_default();
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");
    if method != "GET" && method != "HEAD" {
        write!(
            stream,
            "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n"
        )?;
        return Ok(());
    }
    let uri = target.split('?').next().unwrap_or(target);
    match resolve(root, uri) {
        Some(path) => {
            let bytes = fs::read(&path)?;
            let body: &[u8] = if method == "HEAD" { b"" } else { &bytes };
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\n\r\n",
                content_type(&path),
                if method == "HEAD" { 0 } else { bytes.len() }
            )?;
            stream.write_all(body)?;
        }
        None => {
            write!(
                stream,
                "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
            )?;
        }
    }
    Ok(())
}

fn resolve(root: &Path, uri: &str) -> Option<PathBuf> {
    let decoded = percent_decode(uri.trim_start_matches('/'));
    let mut path = root.join(decoded);
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return None;
    }
    if path.is_dir() {
        path = path.join("index.html");
    }
    if !path.is_file() {
        return None;
    }
    Some(path)
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "svg" => "image/svg+xml",
        "wasm" => "application/wasm",
        "json" => "application/json",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}