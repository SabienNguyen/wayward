use crate::{goals, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_goal(
    state: State<'_, AppState>,
    name: String,
) -> Result<goals::Goal, String> {
    goals::create_goal(&state.db, &name, &state.device_id).await
}

#[tauri::command]
pub async fn cmd_list_goals(state: State<'_, AppState>) -> Result<Vec<goals::Goal>, String> {
    goals::list_goals(&state.db).await
}
