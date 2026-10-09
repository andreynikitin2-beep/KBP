// Ограничение попыток входа: по учётной записи и по адресу.
import { describe, it, expect } from "vitest";
import { LoginThrottle } from "./loginThrottle";

const opts = { windowMs: 60_000, maxPerAccount: 3, maxPerAddress: 5 };

describe("LoginThrottle", () => {
  it("блокирует учётную запись после N неудач и отпускает по истечении окна", () => {
    const t = new LoginThrottle(opts);
    for (let i = 0; i < 3; i++) {
      expect(t.retryAfter("u1", "ip1", 1000 + i)).toBe(0);
      t.recordFailure("u1", "ip1", 1000 + i);
    }
    expect(t.retryAfter("u1", "ip1", 2000)).toBeGreaterThan(0);
    // другая учётная запись с того же адреса ещё может входить
    expect(t.retryAfter("u2", "ip1", 2000)).toBe(0);
    expect(t.retryAfter("u1", "ip1", 1000 + 60_001)).toBe(0);
  });

  it("успешный вход сбрасывает счётчик учётной записи", () => {
    const t = new LoginThrottle(opts);
    t.recordFailure("u1", "ip1", 0);
    t.recordFailure("u1", "ip1", 1);
    t.recordSuccess("u1");
    t.recordFailure("u1", "ip1", 2);
    expect(t.retryAfter("u1", "ip1", 3)).toBe(0);
  });

  it("блокирует адрес, перебирающий разные учётные записи", () => {
    const t = new LoginThrottle(opts);
    for (let i = 0; i < 5; i++) t.recordFailure(`u${i}`, "ip9", i);
    expect(t.retryAfter("u-new", "ip9", 10)).toBeGreaterThan(0);
    expect(t.retryAfter("u-new", "ip-other", 10)).toBe(0);
  });

  it("сообщает, сколько секунд ждать", () => {
    const t = new LoginThrottle(opts);
    for (let i = 0; i < 3; i++) t.recordFailure("u1", "ip1", 0);
    expect(t.retryAfter("u1", "ip1", 30_000)).toBe(30);
  });
});
