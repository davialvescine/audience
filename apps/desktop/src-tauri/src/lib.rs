use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn open_telao_window(
  app: tauri::AppHandle,
  slug: String,
  mode: Option<String>,
) -> Result<(), String> {
  let mode_param = mode.unwrap_or_else(|| "fullscreen".to_string());
  let url_str = format!(
    "https://audience-opal.vercel.app/telao/{}?mode={}",
    slug, mode_param
  );
  let parsed = url_str.parse::<tauri::Url>().map_err(|e| e.to_string())?;

  // Reabrir: se já existe, traz pra frente em vez de criar duplicado.
  if let Some(existing) = app.get_webview_window("telao") {
    let _ = existing.set_focus();
    return Ok(());
  }

  // Modo "fullscreen" = janela pro projetor (com decorações, sem always-on-top).
  // Outros modos (browser_source / desktop_app) = overlay transparente sempre por cima.
  let is_overlay = mode_param != "fullscreen";

  WebviewWindowBuilder::new(&app, "telao", WebviewUrl::External(parsed))
    .title("Audience — Telão")
    .inner_size(1280.0, 720.0)
    .resizable(true)
    .always_on_top(is_overlay)
    .transparent(is_overlay)
    .decorations(!is_overlay)
    .shadow(!is_overlay)
    .skip_taskbar(false)
    .build()
    .map_err(|e| e.to_string())?;

  Ok(())
}

#[tauri::command]
async fn close_telao_window(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(existing) = app.get_webview_window("telao") {
    let _ = existing.close();
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      open_telao_window,
      close_telao_window
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
