import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import type { Session } from '$lib/types';

function path(uid: string, goalId: string) {
  return `users/${uid}/goals/${goalId}/sessions`;
}

export async function loadSessions(uid: string, goalId: string): Promise<Session[]> {
  const q = query(collection(db, path(uid, goalId)), orderBy('logged_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    content: d.data().content as string,
    logged_at: d.data().logged_at?.toMillis?.() ?? Date.now(),
  }));
}

export async function addSession(uid: string, goalId: string, content: string): Promise<void> {
  await addDoc(collection(db, path(uid, goalId)), {
    content,
    logged_at: serverTimestamp(),
  });
}
