use crate::{crypto, journal, AppState};
use tauri::State;

fn get_key(state: &AppState) -> Option<[u8; 32]> {
    *state.journal_key.lock().unwrap()
}

#[tauri::command]
pub async fn cmd_create_journal_entry(
    state: State<'_, AppState>,
    content: String,
) -> Result<journal::JournalEntry, String> {
    let key = get_key(&state);
    journal::create_entry(&state.db, &content, &state.device_id, key.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_journal_entries(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<journal::JournalEntry>, String> {
    let key = get_key(&state);
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
    let key = get_key(&state);
    journal::update_entry(&state.db, &id, &content, key.as_ref())
        .await
        .map_err(|_| "Cannot edit a locked entry".to_string())
}

#[tauri::command]
pub async fn cmd_is_journal_locked(state: State<'_, AppState>) -> Result<bool, String> {
    let enabled = sqlx::query_scalar::<_, String>(
        "SELECT value FROM config WHERE key = 'journal_lock_enabled'",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(enabled.as_deref() == Some("true"))
}

#[tauri::command]
pub async fn cmd_setup_journal_password(
    state: State<'_, AppState>,
    password: String,
    pin: String,
) -> Result<(), String> {
    let key = crypto::setup_password(&state.db, &password, &pin).await?;
    *state.journal_key.lock().unwrap() = Some(key);
    Ok(())
}

#[tauri::command]
pub async fn cmd_unlock_journal(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, String> {
    match crypto::verify_and_get_key(&state.db, &password).await {
        Ok(key) => {
            *state.journal_key.lock().unwrap() = Some(key);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn cmd_lock_journal(state: State<'_, AppState>) -> Result<(), String> {
    *state.journal_key.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn cmd_recover_journal(
    state: State<'_, AppState>,
    pin: String,
    new_password: String,
) -> Result<bool, String> {
    match crypto::recover_with_pin(&state.db, &pin, &new_password).await {
        Ok(key) => {
            *state.journal_key.lock().unwrap() = Some(key);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}
