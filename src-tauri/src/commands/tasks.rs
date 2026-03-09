use crate::{tasks, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_task(
    state: State<'_, AppState>,
    name: String,
    quadrant: i64,
) -> Result<tasks::Task, String> {
    tasks::create_task(&state.db, &name, quadrant, &state.device_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_tasks(
    state: State<'_, AppState>,
    quadrant: i64,
) -> Result<Vec<tasks::Task>, String> {
    tasks::list_tasks(&state.db, quadrant)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_complete_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    tasks::complete_task(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_task(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    tasks::delete_task(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_task_positions(
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    tasks::update_task_positions(&state.db, &ordered_ids)
        .await
        .map_err(|e| e.to_string())
}
