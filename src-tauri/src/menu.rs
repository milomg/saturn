#[cfg(target_os = "windows")]
use saturn_backend::shortcuts::get_emulated_shortcuts;
use saturn_backend::shortcuts::{MenuOptions, MenuOptionsData};
use std::str::FromStr;
#[cfg(target_os = "macos")]
use tauri::menu::AboutMetadata;
use tauri::{
    menu::{Menu, MenuBuilder, MenuEvent, MenuItem, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Wry,
};

fn make_item(app: &AppHandle, option: MenuOptions) -> tauri::Result<MenuItem<Wry>> {
    let mut item = MenuItemBuilder::with_id(option.to_string(), option.label());

    if let Some(accelerator) = option.accelerator() {
        item = item.accelerator(accelerator.combo())
    }

    item.build(app)
}

pub fn get_platform_emulated_shortcuts() -> Vec<MenuOptionsData> {
    #[cfg(target_os = "windows")]
    return get_emulated_shortcuts();

    #[cfg(not(target_os = "windows"))]
    vec![]
}

#[tauri::command]
pub fn platform_shortcuts() -> Vec<MenuOptionsData> {
    get_platform_emulated_shortcuts()
}

pub fn create_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let mut menu = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        let meta = AboutMetadata::default();

        menu = menu.item(
            &SubmenuBuilder::new(app, "Saturn")
                .about(Some(meta))
                .item(&make_item(app, MenuOptions::ToggleSettings)?)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?,
        );
    }

    menu = menu.item(
        &SubmenuBuilder::new(app, "File")
            .item(&make_item(app, MenuOptions::NewTab)?)
            .item(&make_item(app, MenuOptions::OpenFile)?)
            .item(&make_item(app, MenuOptions::CloseTab)?)
            .separator()
            .item(&make_item(app, MenuOptions::Save)?)
            .item(&make_item(app, MenuOptions::SaveAs)?)
            .separator()
            .item(&make_item(app, MenuOptions::Assemble)?)
            .item(&make_item(app, MenuOptions::Disassemble)?)
            .item(&make_item(app, MenuOptions::Export)?)
            .item(&make_item(app, MenuOptions::ExportHex)?)
            .build()?,
    );

    // windows unsupported for some of these, hopefully this wont cause a crash
    menu = menu.item(
        &SubmenuBuilder::new(app, "Edit")
            .cut()
            .copy()
            .paste()
            .separator()
            .undo()
            .redo()
            .separator()
            .item(&make_item(app, MenuOptions::Find)?)
            .select_all()
            .build()?,
    );

    menu = menu.item(
        &SubmenuBuilder::new(app, "Build")
            .item(&make_item(app, MenuOptions::Build)?)
            .item(&make_item(app, MenuOptions::Run)?)
            .separator()
            .item(&make_item(app, MenuOptions::Step)?)
            .item(&make_item(app, MenuOptions::Pause)?)
            .item(&make_item(app, MenuOptions::Stop)?)
            .build()?,
    );

    menu = menu.item(
        &SubmenuBuilder::new(app, "Window")
            .minimize()
            .item(&make_item(app, MenuOptions::ToggleConsole)?)
            .build()?,
    );

    menu.build()
}

pub fn handle_event(window: &AppHandle<Wry>, event: MenuEvent) {
    let catch_emit = |result: tauri::Result<()>| {
        if result.is_err() {
            eprintln!(
                "Failed to emit event from {} menu option",
                event.id.as_ref()
            );
        }
    };

    let emit_normal = |name: &str| catch_emit(window.emit(name, ()));

    let Ok(item) = MenuOptions::from_str(event.id.as_ref()) else {
        return eprintln!("Unknown menu ID: {}", event.id.as_ref());
    };

    emit_normal(&item.to_string())
}
