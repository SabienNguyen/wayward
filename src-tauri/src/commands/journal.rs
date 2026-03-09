use crate::{journal, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_journal_entry(
    state: State<'_, AppState>,
    content: String,
) -> Result<journal::JournalEntry, String> {
    journal::create_entry(&state.db, &content, &state.device_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_journal_entries(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<journal::JournalEntry>, String> {
    journal::list_entries_for_date(&state.db, &date)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_journal_entry(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<(), String> {
    journal::update_entry(&state.db, &id, &content)
        .await
        .map_err(|_| "Cannot edit a locked entry".to_string())
}
