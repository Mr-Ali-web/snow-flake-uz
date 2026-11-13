use tauri::WebviewWindow;

pub fn init(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(monitor) = window.primary_monitor()? {
        let position = monitor.position();
        let size = monitor.size();

        window.set_size(tauri::PhysicalSize::new(size.width, size.height))?;
        window.set_position(tauri::PhysicalPosition::new(position.x, position.y))?;
    }

    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_always_on_top(true);
    let _ = window.set_visible_on_all_workspaces(true);

    Ok(())
}