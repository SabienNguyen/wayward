export interface Goal {
  id: string;
  name: string;
  description: string;
  motivation: string;
  orientation: 'performance' | 'learning';
  created_at: number;
}

export interface Session {
  id: string;
  content: string;
  logged_at: number;
}

export interface Milestone {
  id: string;
  name: string;
  completed: boolean;
  created_at: number;
}

export interface GoalFormData {
  name: string;
  description: string;
  motivation: string;
  orientation: 'performance' | 'learning' | '';
}
