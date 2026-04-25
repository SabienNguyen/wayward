import { describe, it, expect } from 'vitest';
import { validateGoalForm } from './validation';

describe('validateGoalForm', () => {
  it('returns error when name is empty', () => {
    expect(validateGoalForm({ name: '', description: '', motivation: '', orientation: 'learning' }))
      .toBe('Goal name is required');
  });

  it('returns error when name is only whitespace', () => {
    expect(validateGoalForm({ name: '   ', description: '', motivation: '', orientation: 'learning' }))
      .toBe('Goal name is required');
  });

  it('returns error when orientation is not set', () => {
    expect(validateGoalForm({ name: 'My goal', description: '', motivation: '', orientation: '' }))
      .toBe('Please select an orientation');
  });

  it('returns null when form is valid with learning orientation', () => {
    expect(validateGoalForm({ name: 'My goal', description: '', motivation: '', orientation: 'learning' }))
      .toBeNull();
  });

  it('returns null when form is valid with performance orientation', () => {
    expect(validateGoalForm({ name: 'My goal', description: 'some detail', motivation: 'because', orientation: 'performance' }))
      .toBeNull();
  });
});
