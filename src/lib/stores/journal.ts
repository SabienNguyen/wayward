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
