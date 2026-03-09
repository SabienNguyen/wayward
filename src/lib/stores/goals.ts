import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface Goal {
  id: string;
  name: string;
  locked_until: string;
}

export const goals = writable<Goal[]>([]);

export async function loadGoals() {
  const result = await invoke<Goal[]>('cmd_list_goals');
  goals.set(result);
}

export async function addGoal(name: string) {
  await invoke('cmd_create_goal', { name });
  await loadGoals();
}
