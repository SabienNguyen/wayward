import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface Task {
  id: string;
  name: string;
  quadrant: number;
  completed: boolean;
  position: number;
  device_id: string;
  updated_at: number;
}

export const q1Tasks = writable<Task[]>([]);
export const q2Tasks = writable<Task[]>([]);

export async function loadTasks() {
  const [q1, q2] = await Promise.all([
    invoke<Task[]>('cmd_list_tasks', { quadrant: 1 }),
    invoke<Task[]>('cmd_list_tasks', { quadrant: 2 }),
  ]);
  q1Tasks.set(q1);
  q2Tasks.set(q2);
}

export async function addTask(name: string, quadrant: number) {
  await invoke('cmd_create_task', { name, quadrant });
  await loadTasks();
}

export async function completeTask(id: string) {
  await invoke('cmd_complete_task', { id });
  await loadTasks();
}

export async function deleteTask(id: string) {
  await invoke('cmd_delete_task', { id });
  await loadTasks();
}

export async function reorderTasks(orderedIds: string[]) {
  await invoke('cmd_update_task_positions', { ordered_ids: orderedIds });
  await loadTasks();
}
