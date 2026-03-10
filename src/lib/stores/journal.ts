import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface JournalEntry {
  id: string;
  content: string;
  date: string;
  created_at: number;
  device_id: string;
  locked: boolean;
}

export const currentDateEntries = writable<JournalEntry[]>([]);

export async function loadEntriesForDate(date: string) {
  const entries = await invoke<JournalEntry[]>('cmd_list_journal_entries', { date });
  currentDateEntries.set(entries);
}

export async function addEntry(content: string) {
  await invoke('cmd_create_journal_entry', { content });
  const today = new Date().toISOString().split('T')[0];
  await loadEntriesForDate(today);
}

export async function isJournalLocked(): Promise<boolean> {
  return invoke<boolean>('cmd_is_journal_locked');
}

export async function setupJournalPassword(password: string, pin: string): Promise<void> {
  return invoke('cmd_setup_journal_password', { password, pin });
}

export async function unlockJournal(password: string): Promise<boolean> {
  return invoke<boolean>('cmd_unlock_journal', { password });
}

export async function lockJournal(): Promise<void> {
  return invoke('cmd_lock_journal');
}

export async function recoverJournal(pin: string, newPassword: string): Promise<boolean> {
  return invoke<boolean>('cmd_recover_journal', { pin, new_password: newPassword });
}
