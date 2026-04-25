import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import type { Milestone } from '$lib/types';

function path(uid: string, goalId: string) {
  return `users/${uid}/goals/${goalId}/milestones`;
}

export async function loadMilestones(uid: string, goalId: string): Promise<Milestone[]> {
  const q = query(collection(db, path(uid, goalId)), orderBy('created_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name as string,
    completed: d.data().completed as boolean,
    created_at: d.data().created_at?.toMillis?.() ?? Date.now(),
  }));
}

export async function addMilestone(uid: string, goalId: string, name: string): Promise<void> {
  await addDoc(collection(db, path(uid, goalId)), {
    name,
    completed: false,
    created_at: serverTimestamp(),
  });
}

export async function toggleMilestone(
  uid: string, goalId: string, milestoneId: string, completed: boolean
): Promise<void> {
  await updateDoc(doc(db, path(uid, goalId), milestoneId), { completed });
}
