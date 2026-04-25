import type { GoalFormData } from './types';

export function validateGoalForm(data: GoalFormData): string | null {
  if (!data.name.trim()) return 'Goal name is required';
  if (!data.orientation) return 'Please select an orientation';
  return null;
}
