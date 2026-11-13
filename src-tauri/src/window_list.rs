use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::screen::ScreenMap;

#[derive(Debug, Clone, Serialize)]
pub struct WindowRect {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub title: String,
}

struct NativeWindow {
    id: i64,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    title: String,
}

pub fn collect(screen: &ScreenMap) -> Vec<WindowRect> {
    let mut result = Vec::new();

    for window in native_windows() {
        let x = screen.to_css_x(window.x);
        let y = screen.to_css_y(window.y);
        let w = screen.to_css_len(window.w);
        let h = screen.to_css_len(window.h);

        if w < 2.0 || h < 2.0 {
            continue;
        }
        if x > screen.width || y > screen.height {
            continue;
        }
        if x + w < 0.0 || y + h < 0.0 {
            continue;
        }

        result.push(WindowRect {
            id: window.id,
            x,
            y,
            w,
            h,
            title: window.title,
        });

        if result.len() >= 40 {
            break;
        }
    }

    result
}

pub fn spawn(app: AppHandle, screen: ScreenMap) {
    std::thread::spawn(move || {
        let mut last = String::new();

        loop {
            let windows = collect(&screen);
            if let Ok(json) = serde_json::to_string(&windows) {
                if json != last {
                    let _ = app.emit("windows-changed", &windows);
                    last = json;
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}

#[tauri::command]
pub fn list_windows(screen: State<'_, ScreenMap>) -> Vec<WindowRect> {
    collect(&screen)
}

#[cfg(target_os = "macos")]
fn native_windows() -> Vec<NativeWindow> {
    macos_windows()
}

#[cfg(target_os = "windows")]
fn native_windows() -> Vec<NativeWindow> {
    windows_windows()
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn native_windows() -> Vec<NativeWindow> {
    Vec::new()
}

#[cfg(target_os = "macos")]
fn macos_windows() -> Vec<NativeWindow> {
    use std::ffi::CStr;
    use std::os::raw::c_void;

    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;
    use core_foundation_sys::array::{CFArrayGetCount, CFArrayGetValueAtIndex};
    use core_foundation_sys::base::CFIndex;
    use core_foundation_sys::dictionary::CFDictionaryGetValue;
    use core_foundation_sys::number::{
        kCFNumberDoubleType, kCFNumberSInt64Type, CFNumberGetValue,
    };
    use core_foundation_sys::string::{kCFStringEncodingUTF8, CFStringGetCStringPtr};
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowListOptionOnScreenOnly, kCGWindowAlpha,
        kCGWindowBounds, kCGWindowLayer, kCGWindowName, kCGWindowNumber, kCGWindowOwnerName,
        kCGWindowOwnerPID, kCGWindowSharingState,
    };

    unsafe fn number_i64(dict: *const c_void, key: *const c_void) -> Option<i64> {
        let value = CFDictionaryGetValue(dict as *const _, key);
        if value.is_null() {
            return None;
        }

        let mut output: i64 = 0;
        let ok = CFNumberGetValue(
            value as *const _,
            kCFNumberSInt64Type,
            &mut output as *mut i64 as *mut c_void,
        );

        if ok {
            Some(output)
        } else {
            None
        }
    }

    unsafe fn number_f64(dict: *const c_void, key: *const c_void) -> Option<f64> {
        let value = CFDictionaryGetValue(dict as *const _, key);
        if value.is_null() {
            return None;
        }

        let mut output: f64 = 0.0;
        let ok = CFNumberGetValue(
            value as *const _,
            kCFNumberDoubleType,
            &mut output as *mut f64 as *mut c_void,
        );

        if ok {
            Some(output)
        } else {
            None
        }
    }

    unsafe fn string_value(dict: *const c_void, key: *const c_void) -> Option<String> {
        let value = CFDictionaryGetValue(dict as *const _, key);
        if value.is_null() {
            return None;
        }

        let pointer = CFStringGetCStringPtr(value as *const _, kCFStringEncodingUTF8);
        if pointer.is_null() {
            return None;
        }

        Some(CStr::from_ptr(pointer).to_string_lossy().into_owned())
    }

    let Some(array) = copy_window_info(kCGWindowListOptionOnScreenOnly, kCGNullWindowID) else {
        return Vec::new();
    };

    let array_ptr = array.as_concrete_TypeRef();
    let count = unsafe { CFArrayGetCount(array_ptr) } as usize;
    let own_pid = std::process::id() as i64;

    let key_x = CFString::new("X");
    let key_y = CFString::new("Y");
    let key_width = CFString::new("Width");
    let key_height = CFString::new("Height");

    let mut result = Vec::new();

    for index in 0..count {
        let dict =
            unsafe { CFArrayGetValueAtIndex(array_ptr, index as CFIndex) } as *const c_void;
        if dict.is_null() {
            continue;
        }

        let layer = unsafe { number_i64(dict, kCGWindowLayer as *const c_void) }.unwrap_or(0);
        if layer != 0 {
            continue;
        }

        let alpha = unsafe { number_f64(dict, kCGWindowAlpha as *const c_void) }.unwrap_or(1.0);
        if alpha <= 0.01 {
            continue;
        }

        let sharing =
            unsafe { number_i64(dict, kCGWindowSharingState as *const c_void) }.unwrap_or(1);
        if sharing == 0 {
            continue;
        }

        let pid = unsafe { number_i64(dict, kCGWindowOwnerPID as *const c_void) }.unwrap_or(0);
        if pid == 0 || pid == own_pid {
            continue;
        }

        let owner =
            unsafe { string_value(dict, kCGWindowOwnerName as *const c_void) }.unwrap_or_default();
        if owner == "Window Server" {
            continue;
        }

        let bounds = unsafe {
            CFDictionaryGetValue(dict as *const _, kCGWindowBounds as *const c_void)
        } as *const c_void;
        if bounds.is_null() {
            continue;
        }

        let Some(x) =
            (unsafe { number_f64(bounds, key_x.as_concrete_TypeRef() as *const c_void) })
        else {
            continue;
        };
        let Some(y) =
            (unsafe { number_f64(bounds, key_y.as_concrete_TypeRef() as *const c_void) })
        else {
            continue;
        };
        let Some(width) =
            (unsafe { number_f64(bounds, key_width.as_concrete_TypeRef() as *const c_void) })
        else {
            continue;
        };
        let Some(height) =
            (unsafe { number_f64(bounds, key_height.as_concrete_TypeRef() as *const c_void) })
        else {
            continue;
        };

        if width < 1.0 || height < 1.0 {
            continue;
        }

        let title =
            unsafe { string_value(dict, kCGWindowName as *const c_void) }.unwrap_or_default();

        result.push(NativeWindow {
            id: unsafe { number_i64(dict, kCGWindowNumber as *const c_void) }
                .unwrap_or(index as i64 + 1),
            x: x as i32,
            y: y as i32,
            w: width as u32,
            h: height as u32,
            title,
        });

        if result.len() >= 40 {
            break;
        }
    }

    result
}

#[cfg(target_os = "windows")]
fn windows_windows() -> Vec<NativeWindow> {
    use std::ffi::c_void;

    use windows::Win32::Foundation::{HWND, LPARAM, RECT, TRUE};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct Context {
        windows: Vec<NativeWindow>,
        own_pid: u32,
    }

    unsafe extern "system" fn collect_window(
        hwnd: HWND,
        lparam: LPARAM,
    ) -> windows::core::BOOL {
        let context = unsafe { &mut *(lparam.0 as *mut Context) };

        unsafe {
            if IsWindowVisible(hwnd).0 == 0 {
                return TRUE;
            }

            let mut cloaked: i32 = 0;
            let _ = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut i32 as *mut c_void,
                std::mem::size_of::<i32>() as u32,
            );
            if cloaked != 0 {
                return TRUE;
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
            if pid == 0 || pid == context.own_pid {
                return TRUE;
            }

            let mut rect = RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            if GetWindowRect(hwnd, &mut rect as *mut RECT).is_err() {
                return TRUE;
            }

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            if width <= 0 || height <= 0 {
                return TRUE;
            }

            let mut buffer = [0u16; 512];
            let length = GetWindowTextW(hwnd, &mut buffer);
            let title = if length > 0 {
                String::from_utf16_lossy(&buffer[..length as usize])
            } else {
                String::new()
            };

            context.windows.push(NativeWindow {
                id: hwnd.0 as isize as i64,
                x: rect.left,
                y: rect.top,
                w: width as u32,
                h: height as u32,
                title,
            });
        }

        TRUE
    }

    let context = Box::into_raw(Box::new(Context {
        windows: Vec::new(),
        own_pid: std::process::id(),
    }));

    let _ = unsafe { EnumWindows(Some(collect_window), LPARAM(context as isize)) };

    let context = unsafe { *Box::from_raw(context) };
    context.windows
}