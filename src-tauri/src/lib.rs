use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::path::BaseDirectory;
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, RunEvent, WebviewUrl};

// Fixed (not dynamically chosen) so the webview origin — and therefore
// localStorage, where usePlan.ts persists the user's plan setting — stays
// stable across launches.
const PORT: u16 = 47823;

struct Sidecar(Mutex<Option<Child>>);

// GUI apps launched from Finder/Dock (or Windows Explorer) get a minimal PATH
// that usually excludes Homebrew/nvm/Program Files dirs, so a bare
// `Command::new("node")` can fail even though `node` works fine from a
// terminal. Check common install locations first.
//
// NOTE: the Windows candidates below are unverified — written from known
// install-path conventions, not tested on an actual Windows machine.
#[cfg(target_os = "windows")]
fn find_node_binary() -> PathBuf {
    for candidate in [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return path;
        }
    }
    PathBuf::from("node.exe")
}

#[cfg(not(target_os = "windows"))]
fn find_node_binary() -> PathBuf {
    for candidate in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return path;
        }
    }
    PathBuf::from("node")
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let server_js = app
                .path()
                .resolve("standalone/server.js", BaseDirectory::Resource)?;
            let working_dir = server_js
                .parent()
                .expect("SERVER_JS constant has no parent directory")
                .to_path_buf();
            let node_bin = find_node_binary();

            log::info!("Starting Node sidecar: {node_bin:?} {server_js:?}");

            let child = Command::new(&node_bin)
                .arg(&server_js)
                .env("PORT", PORT.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .current_dir(&working_dir)
                .spawn()
                .unwrap_or_else(|e| {
                    panic!(
                        "failed to start Node sidecar at {node_bin:?} ({e}). \
                         Is Node.js installed, and does {server_js:?} exist? \
                         Run `npm run build:standalone` first."
                    )
                });

            *app.state::<Sidecar>().0.lock().unwrap() = Some(child);

            // Don't navigate to the sidecar URL until it's actually accepting
            // connections — otherwise the webview briefly shows a
            // connection-refused error on every launch.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let ready = wait_for_port(PORT, Duration::from_secs(20));
                let handle = app_handle.clone();
                app_handle
                    .run_on_main_thread(move || {
                        if ready {
                            let url = format!("http://127.0.0.1:{PORT}");
                            WebviewWindowBuilder::new(
                                &handle,
                                "main",
                                WebviewUrl::External(url.parse().unwrap()),
                            )
                            .title("Sentinel")
                            .inner_size(1280.0, 860.0)
                            .min_inner_size(960.0, 640.0)
                            .build()
                            .expect("failed to create main window");
                        } else {
                            log::error!("Sidecar did not become ready within 20s");
                            handle.exit(1);
                        }
                    })
                    .expect("failed to dispatch window creation to main thread");
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            if let Some(mut child) = app_handle.state::<Sidecar>().0.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    });
}
