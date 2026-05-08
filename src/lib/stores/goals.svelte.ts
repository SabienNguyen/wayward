import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, serverTimestamp, type DocumentData,
} from 'firebase/firestore';
import type { Goal, GoalFormData } from '$lib/types';

let _goals = $state<Goal[]>([]);

function goalsPath(uid: string) {
  return `users/${uid}/goals`;
}

function toGoal(id: string, data: DocumentData): Goal {
  return {
    id,
    name: data.name,
    description: data.description,
    motivation: data.motivation,
    orientation: data.orientation,
    created_at: data.created_at?.toMillis?.() ?? Date.now(),
  };
}

export const goalsStore = {
  get goals() { return _goals; },

  async load(uid: string) {
    const q = query(collection(db, goalsPath(uid)), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    _goals = snap.docs.map(d => toGoal(d.id, d.data()));
  },

  async create(uid: string, data: Omit<GoalFormData, 'orientation'> & { orientation: 'performance' | 'learning' }) {
    await addDoc(collection(db, goalsPath(uid)), {
      ...data,
      created_at: serverTimestamp(),
    });
    await goalsStore.load(uid);
  },

  async remove(uid: string, goalId: string) {
    await deleteDoc(doc(db, goalsPath(uid), goalId));
    _goals = _goals.filter(g => g.id !== goalId);
  },
};
