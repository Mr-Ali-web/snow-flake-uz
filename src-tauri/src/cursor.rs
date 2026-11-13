use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::screen::ScreenMap;

#[derive(Debug, Clone, Copy, Serialize)]
struct Cursor {
    x: f64,
    y: f64,
}

#[cfg(target_os = "macos")]
fn global_cursor() -> Option<(i32, i32)> {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).ok()?;
    let event = CGEvent::new(source).ok()?;
    let point = event.location();

    Some((point.x as i32, point.y as i32))
}

#[cfg(target_os = "windows")]
fn global_cursor() -> Option<(i32, i32)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut point as *mut POINT) }.ok()?;

    Some((point.x, point.y))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn global_cursor() -> Option<(i32, i32)> {
    None
}

pub fn spawn(app: AppHandle, screen: ScreenMap) {
    std::thread::spawn(move || {
        let mut last = (i32::MIN, i32::MIN);

        loop {
            if let Some((global_x, global_y)) = global_cursor() {
                if global_x.abs_diff(last.0) > 1 || global_y.abs_diff(last.1) > 1 {
                    let cursor = Cursor {
                        x: screen.to_css_x(global_x),
                        y: screen.to_css_y(global_y),
                    };
                    let _ = app.emit("cursor", cursor);
                    last = (global_x, global_y);
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });
}