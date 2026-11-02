// Firebase transport for the sync engine: email/password sign-in + Firestore (REST "lite" SDK).
// Layout:  users/{uid}/meta/{key} = { key, t, n }      users/{uid}/data/{key}__{i} = { v }
// A value is split into chunks of 200k chars so each document stays under Firestore's 1 MiB limit.
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore/lite";
import { firebaseConfig } from "./firebase-config.js";

const CHUNK = 200000;
export const isConfigured = () => !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE") && !firebaseConfig.projectId.startsWith("PASTE");

let app, auth, db;
function init() {
  if (app || !isConfigured()) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
init();

export const currentUser = () => (auth ? auth.currentUser : null);
export const signedIn = () => !!currentUser();
export const ready = async () => { if (auth) await auth.authStateReady(); };
export const onAuth = (cb) => (auth ? onAuthStateChanged(auth, cb) : () => {});
export const signIn = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const signUp = (e, p) => createUserWithEmailAndPassword(auth, e, p);
export const signOut = () => fbSignOut(auth);

const base = () => ["users", currentUser().uid];
const enc = encodeURIComponent;

export async function manifest() {
  const snap = await getDocs(collection(db, ...base(), "meta"));
  return snap.docs.map((d) => ({ key: d.data().key, t: d.data().t }));
}
export async function get(key) {
  const m = await getDoc(doc(db, ...base(), "meta", enc(key)));
  if (!m.exists()) throw new Error("not found");
  const { t, n } = m.data();
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getDoc(doc(db, ...base(), "data", `${enc(key)}__${i}`))));
  return { t, value: parts.map((p) => p.data().v).join("") };
}
export async function put(key, t, value) {
  const prev = await getDoc(doc(db, ...base(), "meta", enc(key)));
  const oldN = prev.exists() ? prev.data().n : 0;
  const n = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < n; i++) await setDoc(doc(db, ...base(), "data", `${enc(key)}__${i}`), { v: value.slice(i * CHUNK, (i + 1) * CHUNK) });
  await setDoc(doc(db, ...base(), "meta", enc(key)), { key, t, n }); // meta LAST: a half-finished write never looks new
  for (let i = n; i < oldN; i++) await deleteDoc(doc(db, ...base(), "data", `${enc(key)}__${i}`));
}
