/** localStorage 的薄封装：隐私模式或存储被禁用时静默失败。 */
export const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* 忽略 */ }
  },
  json<T>(key: string): T | null {
    try { return JSON.parse(this.get(key) ?? "null") as T | null; } catch { return null; }
  },
  setJson(key: string, value: unknown) {
    this.set(key, JSON.stringify(value));
  },
};
