/** Map con tope: al pasarse suelta lo que lleva más tiempo sin usarse (las fotos pesan y la pestaña vive horas). */
export class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v); }
    return v;
  }
  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
    return this;
  }
  has(key: string) { return this.map.has(key); }
  delete(key: string) { return this.map.delete(key); }
}
