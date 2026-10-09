// Brute-force protection for /api/auth/login.
//
// Failed attempts are counted per account and per client address within a
// sliding window. Once a limit is reached, further attempts are refused until
// the window passes; a successful login clears the account's counter. State is
// in memory: it resets on restart, which is acceptable for a single instance.

export type ThrottleOptions = {
  windowMs: number;
  maxPerAccount: number;
  maxPerAddress: number;
};

export const DEFAULT_THROTTLE: ThrottleOptions = {
  windowMs: 15 * 60 * 1000,
  maxPerAccount: 5,
  maxPerAddress: 20,
};

export class LoginThrottle {
  private failures = new Map<string, number[]>();

  constructor(private opts: ThrottleOptions = DEFAULT_THROTTLE) {}

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.opts.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** Seconds until the next attempt is allowed, or 0 if it is allowed now. */
  retryAfter(account: string, address: string, now: number = Date.now()): number {
    const checks: [string, number][] = [
      [`a:${account}`, this.opts.maxPerAccount],
      [`ip:${address}`, this.opts.maxPerAddress],
    ];
    let wait = 0;
    for (const [key, max] of checks) {
      const list = this.recent(key, now);
      if (list.length >= max) {
        const oldestRelevant = list[list.length - max];
        wait = Math.max(wait, Math.ceil((oldestRelevant + this.opts.windowMs - now) / 1000));
      }
    }
    return wait;
  }

  recordFailure(account: string, address: string, now: number = Date.now()): void {
    for (const key of [`a:${account}`, `ip:${address}`]) {
      const list = this.recent(key, now);
      list.push(now);
      this.failures.set(key, list);
    }
  }

  recordSuccess(account: string): void {
    this.failures.delete(`a:${account}`);
  }
}
