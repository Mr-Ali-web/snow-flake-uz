mod cursor;
mod overlay;
mod screen;
mod settings;
mod tray;
mod window_list;

use std::sync::Mutex;

use tauri::Manager;

use screen::ScreenMap;
use settings::Settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let Some(window) = app.get_webview_window("main") else {
                return Ok(());
            };

            let Some(monitor) = window.primary_monitor()? else {
                return Ok(());
            };

            let screen = ScreenMap::from_monitor(&monitor);

            app.manage(screen);
            app.manage(Mutex::new(Settings::default()));

            overlay::init(&window)?;

            window_list::spawn(app.handle().clone(), screen);
            cursor::spawn(app.handle().clone(), screen);
            tray::create(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_list::list_windows,
            settings::get_settings,
            settings::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}