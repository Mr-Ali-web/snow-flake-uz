use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};

use crate::settings::Settings;

fn toggle(settings: &mut Settings, key: &str) {
    match key {
        "snow" => settings.snow = !settings.snow,
        "aurora" => settings.aurora = !settings.aurora,
        "frost" => settings.frost = !settings.frost,
        "plow" => settings.plow = !settings.plow,
        "countdown" => settings.countdown = !settings.countdown,
        _ => {}
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let snow = MenuItem::with_id(app, "toggle_snow", "Snow: toggle", true, None::<&str>)?;
    let aurora = MenuItem::with_id(app, "toggle_aurora", "Aurora: toggle", true, None::<&str>)?;
    let frost = MenuItem::with_id(app, "toggle_frost", "Frost: toggle", true, None::<&str>)?;
    let plow = MenuItem::with_id(app, "toggle_plow", "Snowplow: auto / manual", true, None::<&str>)?;
    let countdown =
        MenuItem::with_id(app, "toggle_countdown", "Countdown: toggle", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Flake", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &snow,
            &aurora,
            &frost,
            &plow,
            &countdown,
            &quit,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("the default window icon must be bundled");

    let _tray = TrayIconBuilder::with_id("flake-tray")
        .icon(icon)
        .tooltip("Flake — snow overlay")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();

            if id == "quit" {
                app.exit(0);
                return;
            }

            let key = match id.as_str() {
                "toggle_snow" => "snow",
                "toggle_aurora" => "aurora",
                "toggle_frost" => "frost",
                "toggle_plow" => "plow",
                "toggle_countdown" => "countdown",
                _ => return,
            };

            let state = app.state::<std::sync::Mutex<Settings>>();
            let next = {
                let mut settings = state.lock().unwrap();
                toggle(&mut settings, key);
                settings.clone()
            };

            let _ = app.emit("settings-changed", &next);
        })
        .build(app)?;

    Ok(())
}