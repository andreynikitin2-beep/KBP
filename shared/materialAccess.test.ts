// Права на материалы: видимость, создание версий, переходы статусов.
import { describe, it, expect } from "vitest";
import {
  canCreateVersion,
  canUpdateVersion,
  canViewVersion,
  isMaterialManager,
  type AccessContext,
  type VersionRow,
} from "./materialAccess";

const admin = { id: "u-admin", roles: ["Администратор"] };
const author = { id: "u-author", roles: ["Автор"] };
const owner = { id: "u-owner", roles: ["Владелец"] };
const deputy = { id: "u-deputy", roles: ["Заместитель владельца"] };
const secOwner = { id: "u-sec", roles: ["Читатель"] };
const member = { id: "u-member", roles: ["Читатель"] };
const stranger = { id: "u-stranger", roles: ["Читатель"] };

const ctx: AccessContext = {
  groups: [
    { id: "g-all", isSystem: true, memberIds: [] },
    { id: "g-closed", isSystem: false, memberIds: ["u-member"] },
  ],
  nodes: [
    { id: "s-1", type: "section", parentId: null, ownerIds: ["u-sec"] },
    { id: "s-1-a", type: "subsection", parentId: "s-1", ownerIds: [] },
  ],
  effectiveGroupIds: {},
};

function v(over: Partial<VersionRow> = {}): VersionRow {
  return {
    id: "v-1",
    materialId: "m-1",
    createdBy: "u-author",
    ownerId: "u-owner",
    deputyId: "u-deputy",
    sectionId: "s-1-a",
    visibilityGroupIds: ["g-closed"],
    status: "Опубликовано",
    approvalStep: null,
    nextReviewAt: null,
    ...over,
  };
}

describe("canViewVersion", () => {
  it("закрытую группу видят её участники, автор, владелец, заместитель, владелец раздела и админ", () => {
    for (const u of [admin, author, owner, deputy, secOwner, member]) {
      expect(canViewVersion(u, v(), ctx)).toBe(true);
    }
    expect(canViewVersion(stranger, v(), ctx)).toBe(false);
  });

  it("системная группа и пустой список групп открыты всем", () => {
    expect(canViewVersion(stranger, v({ visibilityGroupIds: ["g-all"] }), ctx)).toBe(true);
    expect(canViewVersion(stranger, v({ visibilityGroupIds: [] }), ctx)).toBe(true);
  });

  it("учитывает группы опубликованной версии (effective)", () => {
    const withEffective = { ...ctx, effectiveGroupIds: { "m-1": ["g-all"] } };
    expect(canViewVersion(stranger, v(), withEffective)).toBe(true);
  });
});

describe("isMaterialManager", () => {
  it("автор любой версии, владелец, заместитель, владелец раздела и админ управляют материалом", () => {
    const other = v({ id: "v-2", createdBy: "u-x" });
    for (const u of [admin, owner, deputy, secOwner]) expect(isMaterialManager(u, other, [other], ctx)).toBe(true);
    expect(isMaterialManager(author, other, [v(), other], ctx)).toBe(true);
    expect(isMaterialManager(member, other, [v(), other], ctx)).toBe(false);
  });
});

describe("canCreateVersion", () => {
  it("новый материал создают авторы, владельцы и админы, читатель — нет", () => {
    const draft = v({ status: "Черновик", createdBy: "u-author" });
    expect(canCreateVersion(author, draft, [], ctx).ok).toBe(true);
    expect(canCreateVersion(member, { ...draft, createdBy: "u-member" }, [], ctx).ok).toBe(false);
  });

  it("новую версию создаёт управляющий материалом и только как черновик", () => {
    const existing = [v()];
    expect(canCreateVersion(owner, v({ id: "v-2", status: "Черновик", createdBy: "u-owner" }), existing, ctx).ok).toBe(true);
    expect(canCreateVersion(owner, v({ id: "v-2", status: "Опубликовано", createdBy: "u-owner" }), existing, ctx).ok).toBe(false);
    expect(canCreateVersion(member, v({ id: "v-2", status: "Черновик", createdBy: "u-member" }), existing, ctx).ok).toBe(false);
  });
});

describe("canUpdateVersion", () => {
  const all = [v()];

  it("счётчики просмотров и оценок через PATCH не меняет никто, кроме админа — их ведёт сервер", () => {
    expect(canUpdateVersion(member, v(), { views: 5 }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(owner, v(), { helpfulYes: 2 }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(owner, v(), { title: "x", views: 1_000_000 }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(admin, v(), { views: 5 }, all, ctx).ok).toBe(true);
  });

  it("читатель не может менять содержимое и статус", () => {
    expect(canUpdateVersion(member, v(), { title: "x" }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(member, v(), { status: "Архив" }, all, ctx).ok).toBe(false);
  });

  it("читатель не переводит материал на пересмотр — просрочку проверяет сервер", () => {
    const overdue = v({ nextReviewAt: new Date(Date.now() - 86_400_000) });
    expect(canUpdateVersion(member, overdue, { status: "На пересмотре" }, [overdue], ctx).ok).toBe(false);
  });

  it("нельзя менять materialId и createdBy", () => {
    expect(canUpdateVersion(owner, v(), { materialId: "m-other" }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(owner, v(), { createdBy: "u-owner" }, all, ctx).ok).toBe(false);
    expect(canUpdateVersion(admin, v(), { materialId: "m-other" }, all, ctx).ok).toBe(false);
  });

  it("на согласование отправляет только автор черновика", () => {
    const draft = v({ status: "Черновик" });
    expect(canUpdateVersion(author, draft, { status: "На согласовании", approvalStep: "material_owner" }, [draft], ctx).ok).toBe(true);
    expect(canUpdateVersion(owner, draft, { status: "На согласовании" }, [draft], ctx).ok).toBe(false);
  });

  it("согласование: шаг владельца материала, затем шаг владельца раздела", () => {
    const step1 = v({ status: "На согласовании", approvalStep: "material_owner" });
    expect(canUpdateVersion(owner, step1, { approvalStep: "section_owner", changelog: "ok" }, [step1], ctx).ok).toBe(true);
    expect(canUpdateVersion(author, step1, { approvalStep: "section_owner" }, [step1], ctx).ok).toBe(false);
    expect(canUpdateVersion(author, step1, { status: "Опубликовано" }, [step1], ctx).ok).toBe(false);

    const step2 = v({ status: "На согласовании", approvalStep: "section_owner" });
    expect(canUpdateVersion(secOwner, step2, { status: "Опубликовано", approvalStep: null }, [step2], ctx).ok).toBe(true);
    expect(canUpdateVersion(owner, step2, { status: "Опубликовано" }, [step2], ctx).ok).toBe(false);
  });

  it("вернуть на доработку может согласующий текущего шага", () => {
    const review = v({ status: "На согласовании", approvalStep: "material_owner" });
    expect(canUpdateVersion(deputy, review, { status: "Черновик", rejectedAt: new Date() }, [review], ctx).ok).toBe(true);
    expect(canUpdateVersion(author, review, { status: "Черновик" }, [review], ctx).ok).toBe(false);
  });

  it("опубликовать черновик в обход согласования может только админ", () => {
    const draft = v({ status: "Черновик" });
    expect(canUpdateVersion(owner, draft, { status: "Опубликовано" }, [draft], ctx).ok).toBe(false);
    expect(canUpdateVersion(admin, draft, { status: "Опубликовано" }, [draft], ctx).ok).toBe(true);
  });

  it("подтвердить актуальность (с пересмотра в опубликовано) может владелец или заместитель", () => {
    const rev = v({ status: "На пересмотре" });
    expect(canUpdateVersion(owner, rev, { status: "Опубликовано", lastReviewedAt: new Date() }, [rev], ctx).ok).toBe(true);
    expect(canUpdateVersion(author, rev, { status: "Опубликовано" }, [rev], ctx).ok).toBe(false);
  });

  it("архивировать может управляющий материалом", () => {
    expect(canUpdateVersion(secOwner, v(), { status: "Архив", archivedBy: "u-sec" }, all, ctx).ok).toBe(true);
    expect(canUpdateVersion(author, v(), { status: "Архив" }, all, ctx).ok).toBe(true);
  });
});
