const DB_NAME = "cffreeusage";
const STORE = "secrets";
const KEY_ID = "oauth-aes-key";
const TOKEN_ID = "oauth-token";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getValue(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putValue(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteValue(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getCryptoKey() {
  let key = await getValue(KEY_ID);
  if (key) return key;
  key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await putValue(KEY_ID, key);
  return key;
}

export async function saveToken(token) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(token));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  await putValue(TOKEN_ID, { iv: [...iv], cipher: [...new Uint8Array(cipher)] });
}

export async function loadToken() {
  const encrypted = await getValue(TOKEN_ID);
  if (!encrypted) return null;
  try {
    const key = await getCryptoKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(encrypted.iv) },
      key,
      new Uint8Array(encrypted.cipher)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    await deleteValue(TOKEN_ID);
    return null;
  }
}

export async function clearToken() {
  await deleteValue(TOKEN_ID);
}
