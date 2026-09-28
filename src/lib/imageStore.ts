import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { uid } from './dates';

/**
 * Screenshots for the trading journal. They're shrunk and saved on the device
 * (app files on the phone, IndexedDB on the web), separate from the main log so
 * the log stays small. Only the image id goes in the journal entry.
 */

export interface SavedImage {
  id: string;
  uri: string; // something an <Image> can show right now
  base64: string; // jpeg, for sending to Claude
}

const isWeb = Platform.OS === 'web';

// ---------- phone: files in the app's document folder ----------
function dir(): Directory {
  const d = new Directory(Paths.document, 'trade-images');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

// ---------- web: IndexedDB ----------
const memory = new Map<string, string>();
function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('lifelog-images', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function idbPut(id: string, dataUrl: string) {
  memory.set(id, dataUrl);
  const db = await idb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
async function idbGet(id: string): Promise<string | null> {
  if (memory.has(id)) return memory.get(id)!;
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction('images', 'readonly').objectStore('images').get(id);
      req.onsuccess = () => {
        const v = typeof req.result === 'string' ? req.result : null;
        if (v) memory.set(id, v);
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function idbDelete(id: string) {
  memory.delete(id);
  const db = await idb();
  if (!db) return;
  try {
    db.transaction('images', 'readwrite').objectStore('images').delete(id);
  } catch {
    // ignore
  }
}

/** Let the person pick screenshots, then shrink and save them. */
export async function pickImages(limit = 4): Promise<SavedImage[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (res.canceled || !res.assets?.length) return [];
  const out: SavedImage[] = [];
  for (const a of res.assets.slice(0, limit)) {
    const saved = await saveImage(a.uri, a.width);
    if (saved) out.push(saved);
  }
  return out;
}

export async function saveImage(uri: string, width?: number): Promise<SavedImage | null> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    if (!width || width > 1600) ctx.resize({ width: 1600 });
    const rendered = await ctx.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    const id = uid();
    const base64 = result.base64 ?? '';
    if (isWeb) {
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      await idbPut(id, dataUrl);
      return { id, uri: dataUrl, base64 };
    }
    const dest = new File(dir(), `${id}.jpg`);
    await new File(result.uri).copy(dest);
    return { id, uri: dest.uri, base64 };
  } catch {
    return null;
  }
}

export async function imageUri(id: string): Promise<string | null> {
  if (isWeb) return idbGet(id);
  try {
    const f = new File(dir(), `${id}.jpg`);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export async function imageBase64(id: string): Promise<string | null> {
  if (isWeb) {
    const d = await idbGet(id);
    return d ? d.replace(/^data:image\/\w+;base64,/, '') : null;
  }
  try {
    const f = new File(dir(), `${id}.jpg`);
    return f.exists ? await f.base64() : null;
  } catch {
    return null;
  }
}

export async function deleteImage(id: string) {
  if (isWeb) return idbDelete(id);
  try {
    const f = new File(dir(), `${id}.jpg`);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

/** Resolve an image id to something <Image> can show. */
export function useImageUri(id: string | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    imageUri(id).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return id ? uri : null;
}
