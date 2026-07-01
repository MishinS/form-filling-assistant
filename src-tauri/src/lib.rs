mod runtime;
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
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
      runtime::detect_local_runtime,
      runtime::llm_chat,
      files::pick_directory,
      files::save_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
