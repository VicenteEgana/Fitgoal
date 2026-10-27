/** Contador de ventana fija en memoria (una sola instancia, suficiente para el piloto). */
export class WindowCounter {
  constructor({ windowMs, max, now = () => Date.now() }) {
    this.windowMs = windowMs;
    this.max = max;
    this.now = now;
    this.entries = new Map();
  }

  #entry(key) {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
      if (this.entries.size > 5000) this.#sweep(now);
    }
    return entry;
  }

  #sweep(now) {
    for (const [key, entry] of this.entries) if (entry.resetAt <= now) this.entries.delete(key);
  }

  /** Cuenta un uso. */
  hit(key) {
    const entry = this.#entry(key);
    entry.count += 1;
    return this.#status(entry);
  }

  /** Consulta sin contar. */
  peek(key) {
    return this.#status(this.#entry(key));
  }

  reset(key) {
    this.entries.delete(key);
  }

  #status(entry) {
    // allowed: el último uso aún cabe en el límite; blocked: ya se alcanzó el máximo y el siguiente se rechaza.
    return { allowed: entry.count <= this.max, blocked: entry.count >= this.max, remaining: Math.max(0, this.max - entry.count), retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - this.now()) / 1000)) };
  }
}
