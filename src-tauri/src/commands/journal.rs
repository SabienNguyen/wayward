use crate::{journal, AppState};
use tauri::State;

#[tauri::command]
pub async fn cmd_create_journal_entry(
    state: State<'_, AppState>,
    content: String,
) -> Result<journal::JournalEntry, String> {
    let key = state.journal_key.lock().unwrap().clone();
    journal::create_entry(&state.db, &content, &state.device_id, key.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_journal_entries(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<journal::JournalEntry>, String> {
    let key = state.journal_key.lock().unwrap().clone();
    journal::list_entries_for_date(&state.db, &date, key.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_journal_entry(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<(), String> {
    let key = state.journal_key.lock().unwrap().clone();
    journal::update_entry(&state.db, &id, &content, key.as_ref())
        .await
        .map_err(|_| "Cannot edit a locked entry".to_string())
}
