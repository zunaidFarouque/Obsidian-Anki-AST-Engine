import { Mutex } from "async-mutex";

const mutexes = new Map<string, Mutex>();

export function getMutex(absolutePath: string): Mutex {
  let mutex = mutexes.get(absolutePath);
  if (!mutex) {
    mutex = new Mutex();
    mutexes.set(absolutePath, mutex);
  }
  return mutex;
}

export async function runExclusive<T>(
  absolutePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  return getMutex(absolutePath).runExclusive(fn);
}
