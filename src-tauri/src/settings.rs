use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub snow: bool,
    pub aurora: bool,
    pub frost: bool,
    pub plow: bool,
    pub countdown: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            snow: true,
            aurora: true,
            frost: true,
            plow: false,
            countdown: true,
        }
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, std::sync::Mutex<Settings>>) -> Settings {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, std::sync::Mutex<Settings>>,
    key: String,
    value: bool,
) {
    let mut settings = state.lock().unwrap();
    match key.as_str() {
        "snow" => settings.snow = value,
        "aurora" => settings.aurora = value,
        "frost" => settings.frost = value,
        "plow" => settings.plow = value,
        "countdown" => settings.countdown = value,
        _ => {}
    }
}