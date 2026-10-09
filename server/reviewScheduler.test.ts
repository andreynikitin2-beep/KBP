// Серверная проверка просрочки: перевод на пересмотр и письмо владельцу.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { transitionOverdueVersions, getUsers, createNotification, kickEmailQueue } = vi.hoisted(() => ({
  transitionOverdueVersions: vi.fn(),
  getUsers: vi.fn(),
  createNotification: vi.fn(),
  kickEmailQueue: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: { transitionOverdueVersions, getUsers, createNotification } }));
vi.mock("./mailer", () => ({ kickEmailQueue }));

const { runOverdueCheck } = await import("./reviewScheduler");

beforeEach(() => {
  vi.clearAllMocks();
  getUsers.mockResolvedValue([
    { id: "u-owner", email: "owner@demo.local" },
    { id: "u-noemail", email: "" },
  ]);
});

describe("runOverdueCheck", () => {
  it("ничего не делает, если просроченных нет", async () => {
    transitionOverdueVersions.mockResolvedValue([]);
    expect(await runOverdueCheck()).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
    expect(kickEmailQueue).not.toHaveBeenCalled();
  });

  it("ставит письмо владельцу каждого переведённого материала", async () => {
    transitionOverdueVersions.mockResolvedValue([
      { id: "v-1", materialId: "m-1", title: "VPN", ownerId: "u-owner" },
      { id: "v-2", materialId: "m-2", title: "Без почты", ownerId: "u-noemail" },
      { id: "v-3", materialId: "m-3", title: "Без владельца", ownerId: null },
    ]);
    expect(await runOverdueCheck(new Date("2026-10-09T00:00:00Z"))).toBe(3);
    expect(transitionOverdueVersions).toHaveBeenCalledWith(new Date("2026-10-09T00:00:00Z"));
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      toAddress: "owner@demo.local",
      subject: "Просрочка пересмотра: VPN",
      template: "overdue",
      relatedMaterialId: "m-1",
      relatedVersionId: "v-1",
      status: "LOGGED",
    }));
    expect(kickEmailQueue).toHaveBeenCalledTimes(1);
  });
});
