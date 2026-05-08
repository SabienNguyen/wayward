import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collRef'),
  addDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  updateDoc: vi.fn(),
  doc: vi.fn(() => 'docRef'),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { addMilestone, loadMilestones, toggleMilestone } from './milestones';

beforeEach(() => vi.clearAllMocks());

describe('addMilestone', () => {
  it('calls addDoc with name, completed false, and timestamp', async () => {
    await addMilestone('uid1', 'goal1', 'Ship MVP');
    expect(addDoc).toHaveBeenCalledWith(
      'collRef',
      { name: 'Ship MVP', completed: false, created_at: 'SERVER_TS' }
    );
  });
});

describe('loadMilestones', () => {
  it('returns empty array when no docs', async () => {
    expect(await loadMilestones('uid1', 'goal1')).toEqual([]);
  });

  it('maps docs to Milestone objects', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{
        id: 'm1',
        data: () => ({ name: 'First milestone', completed: true, created_at: { toMillis: () => 500 } }),
      }],
    } as any);
    expect(await loadMilestones('uid1', 'goal1')).toEqual([
      { id: 'm1', name: 'First milestone', completed: true, created_at: 500 }
    ]);
  });
});

describe('toggleMilestone', () => {
  it('calls updateDoc with completed value', async () => {
    await toggleMilestone('uid1', 'goal1', 'm1', true);
    expect(updateDoc).toHaveBeenCalledWith('docRef', { completed: true });
  });
});
