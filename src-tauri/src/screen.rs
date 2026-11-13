#[derive(Clone, Copy, Debug)]
pub struct ScreenMap {
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub scale: f64,
    pub origin_x: f64,
    pub origin_y: f64,
    pub width: f64,
    pub height: f64,
}

impl ScreenMap {
    pub fn from_monitor(monitor: &tauri::Monitor) -> Self {
        let scale = monitor.scale_factor();
        let position = monitor.position();
        let size = monitor.size();

        Self {
            scale,
            origin_x: position.x as f64 / scale,
            origin_y: position.y as f64 / scale,
            width: size.width as f64 / scale,
            height: size.height as f64 / scale,
        }
    }

    pub fn to_css_x(&self, x: i32) -> f64 {
        #[cfg(target_os = "macos")]
        {
            x as f64 - self.origin_x
        }
        #[cfg(not(target_os = "macos"))]
        {
            x as f64 / self.scale - self.origin_x
        }
    }

    pub fn to_css_y(&self, y: i32) -> f64 {
        #[cfg(target_os = "macos")]
        {
            y as f64 - self.origin_y
        }
        #[cfg(not(target_os = "macos"))]
        {
            y as f64 / self.scale - self.origin_y
        }
    }

    pub fn to_css_len(&self, value: u32) -> f64 {
        #[cfg(target_os = "macos")]
        {
            value as f64
        }
        #[cfg(not(target_os = "macos"))]
        {
            value as f64 / self.scale
        }
    }
}