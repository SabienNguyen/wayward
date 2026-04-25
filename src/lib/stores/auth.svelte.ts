import { auth } from '$lib/firebase';
import {
  GoogleAuthProvider, signInWithPopup,
  signOut as fbSignOut, onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

let _user = $state<User | null>(null);
let _loading = $state(true);

onAuthStateChanged(auth, (u) => {
  _user = u;
  _loading = false;
});

export const authStore = {
  get user() { return _user; },
  get loading() { return _loading; },

  async signIn() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  },

  async signOut() {
    await fbSignOut(auth);
  },
};
