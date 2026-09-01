/**
 * 테스트 환경 준비.
 * environment: 'node' 이므로 localStorage 가 없다. Zustand persist 미들웨어가
 * 접근할 수 있도록 메모리 기반 shim 을 넣어 준다. (테스트마다 초기화)
 */
const store = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (k: string) => store.get(k) ?? null,
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  removeItem: (k: string) => void store.delete(k),
  setItem: (k: string, v: string) => void store.set(k, v),
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, writable: true });
}
