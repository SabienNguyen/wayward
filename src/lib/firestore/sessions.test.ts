import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collRef'),
  addDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { addDoc, getDocs } from 'firebase/firestore';
import { addSession, loadSessions } from './sessions';

beforeEach(() => vi.clearAllMocks());

describe('addSession', () => {
  it('calls addDoc with content and server timestamp', async () => {
    await addSession('uid1', 'goal1', 'Great session');
    expect(addDoc).toHaveBeenCalledWith(
      'collRef',
      { content: 'Great session', logged_at: 'SERVER_TS' }
    );
  });
});

describe('loadSessions', () => {
  it('returns empty array when no docs', async () => {
    const result = await loadSessions('uid1', 'goal1');
    expect(result).toEqual([]);
  });

  it('maps Firestore docs to Session objects', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{
        id: 'sess1',
        data: () => ({ content: 'Did well', logged_at: { toMillis: () => 1000 } }),
      }],
    } as any);
    const result = await loadSessions('uid1', 'goal1');
    expect(result).toEqual([{ id: 'sess1', content: 'Did well', logged_at: 1000 }]);
  });
});
