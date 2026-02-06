export type Role =
  | "Читатель"
  | "Автор"
  | "Владелец"
  | "Заместитель владельца"
  | "Администратор";

export type Status =
  | "Черновик"
  | "На согласовании"
  | "Опубликовано"
  | "На пересмотре"
  | "Архив";

export type Criticality = "Низкая" | "Средняя" | "Высокая" | "Критическая";

export type User = {
  id: string;
  displayName: string;
  email: string;
  roles: Role[];
  legalEntity: string;
  branch: string;
  department: string;
  isAvailable: boolean;
};

export type CatalogNode = {
  id: string;
  title: string;
  type: "section" | "subsection";
  parentId?: string;
  allowedRoles?: Role[];
  allowedLegalEntities?: string[];
  allowedBranches?: string[];
};

export type Passport = {
  title: string;
  purpose?: string;
  tags: string[];
  tagGroups: { group: string; tags: string[] }[];
  criticality: Criticality;
  sectionId: string;
  ownerId?: string;
  deputyId?: string;
  legalEntity: string;
  branch: string;
  department?: string;
  requiredTraining?: boolean;
  relatedLinks?: { label: string; url: string }[];
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewPeriodDays?: number;
};

export type MaterialVersion = {
  id: string;
  materialId: string;
  version: string;
  createdAt: string;
  createdBy: string;
  changelog?: string;
  status: Status;
  passport: Passport;
  content: {
    kind: "file" | "page";
    file?: { name: string; type: "pdf" | "docx"; extractedText?: string };
    page?: { blocks: { id: string; type: "heading" | "paragraph" | "list"; text: string; anchor?: string }[] };
  };
  subscribers: string[];
  discussionsEnabled: boolean;
  discussionVisibility: "Все" | "Только сотрудники раздела" | "Только владелец/заместитель";
  stats: { views: number; helpfulYes: number; helpfulNo: number };
  auditViews: { userId: string; at: string }[];
};

export type RFC = {
  id: string;
  materialId: string;
  createdAt: string;
  createdBy: string;
  type: "Проблема" | "Предложение";
  title: string;
  description: string;
  status: "Новый" | "В работе" | "Решён" | "Отклонён";
  assignedTo: string;
  sla: { reactedAt?: string; updatedAt?: string };
  comments: { id: string; at: string; by: string; text: string }[];
};

export type NotificationLog = {
  id: string;
  at: string;
  to: string;
  subject: string;
  template:
    | "reminder_before"
    | "reminder_due"
    | "overdue"
    | "escalation"
    | "new_version"
    | "auto_transition";
  related: { materialId?: string; versionId?: string; rfcId?: string };
  status: "LOGGED" | "SENT" | "FAILED";
};

export const demoUsers: User[] = [
  {
    id: "u-reader",
    displayName: "Ирина Смирнова",
    email: "reader@demo.local",
    roles: ["Читатель"],
    legalEntity: "ООО «Альфа»",
    branch: "Москва",
    department: "Операции",
    isAvailable: true,
  },
  {
    id: "u-author",
    displayName: "Алексей Петров",
    email: "author@demo.local",
    roles: ["Автор", "Читатель"],
    legalEntity: "ООО «Альфа»",
    branch: "Москва",
    department: "Процессы",
    isAvailable: true,
  },
  {
    id: "u-owner",
    displayName: "Мария Иванова",
    email: "owner@demo.local",
    roles: ["Владелец", "Автор"],
    legalEntity: "АО «Бета»",
    branch: "Санкт‑Петербург",
    department: "Качество",
    isAvailable: true,
  },
  {
    id: "u-deputy",
    displayName: "Сергей Кузнецов",
    email: "deputy@demo.local",
    roles: ["Заместитель владельца"],
    legalEntity: "АО «Бета»",
    branch: "Санкт‑Петербург",
    department: "Качество",
    isAvailable: false,
  },
  {
    id: "u-kbadmin",
    displayName: "Наталья Орлова",
    email: "moderator@demo.local",
    roles: ["Администратор"],
    legalEntity: "ООО «Альфа»",
    branch: "Екатеринбург",
    department: "База знаний",
    isAvailable: true,
  },
  {
    id: "u-sec",
    displayName: "Вадим Соколов",
    email: "secadmin@demo.local",
    roles: ["Читатель"],
    legalEntity: "ООО «Альфа»",
    branch: "Москва",
    department: "Безопасность",
    isAvailable: true,
  },
  {
    id: "u-aud",
    displayName: "Ольга Миронова",
    email: "auditor@demo.local",
    roles: ["Читатель"],
    legalEntity: "АО «Бета»",
    branch: "Санкт‑Петербург",
    department: "Аудит",
    isAvailable: true,
  },
];

export type VisibilityGroup = {
  id: string;
  title: string;
  isSystem: boolean;
  memberIds: string[];
};

export const visibilityGroups: VisibilityGroup[] = [
  {
    id: "g-base",
    title: "Базовая",
    isSystem: true,
    memberIds: demoUsers.map((u) => u.id),
  },
  {
    id: "g-hr-confidential",
    title: "HR Конфиденциально",
    isSystem: false,
    memberIds: ["u-owner", "u-kbadmin"],
  },
];

export const catalog: CatalogNode[] = [
  {
    id: "sec-hr",
    title: "Кадры и организационные процедуры",
    type: "section",
    allowedLegalEntities: ["ООО «Альфа»", "АО «Бета»"],
  },
  {
    id: "sub-onb",
    title: "Онбординг",
    type: "subsection",
    parentId: "sec-hr",
  },
  {
    id: "sub-leave",
    title: "Отпуска и отсутствия",
    type: "subsection",
    parentId: "sec-hr",
  },
  {
    id: "sec-it",
    title: "IT и доступы",
    type: "section",
    allowedRoles: ["Автор", "Владелец", "Заместитель владельца", "Администратор", "Читатель"],
    allowedBranches: ["Москва", "Санкт‑Петербург", "Екатеринбург"],
  },
  {
    id: "sub-vpn",
    title: "VPN и удалённый доступ",
    type: "subsection",
    parentId: "sec-it",
  },
  {
    id: "sub-accounts",
    title: "Учётные записи",
    type: "subsection",
    parentId: "sec-it",
  },
  {
    id: "sec-qa",
    title: "Качество и регламенты",
    type: "section",
    allowedLegalEntities: ["АО «Бета»"],
    allowedBranches: ["Санкт‑Петербург"],
  },
  {
    id: "sub-audit",
    title: "Внутренние проверки",
    type: "subsection",
    parentId: "sec-qa",
  },
];

const now = new Date();
const iso = (d: Date) => d.toISOString();
const days = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d;
};

export const materials: MaterialVersion[] = [
  {
    id: "v-100-1",
    materialId: "m-100",
    version: "1.2",
    createdAt: iso(days(-40)),
    createdBy: "u-owner",
    changelog: "Обновлены скриншоты и срок пересмотра.",
    status: "Опубликовано",
    passport: {
      title: "Как подключиться к корпоративному VPN",
      purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ", "удалёнка"],
      tagGroups: [
        { group: "IT", tags: ["vpn", "учётка"] },
        { group: "Риски", tags: ["безопасность"] },
      ],
      criticality: "Высокая",
      sectionId: "sub-vpn",
      ownerId: "u-owner",
      deputyId: "u-deputy",
      legalEntity: "АО «Бета»",
      branch: "Санкт‑Петербург",
      department: "Качество",
      lastReviewedAt: iso(days(-75)),
      nextReviewAt: iso(days(-5)),
      reviewPeriodDays: 90,
      relatedLinks: [
        { label: "Заявка в ServiceDesk", url: "https://example.local/servicedesk" },
      ],
    },
    content: {
      kind: "file",
      file: {
        name: "VPN_Инструкция.pdf",
        type: "pdf",
        extractedText:
          "VPN инструкция: установка клиента, настройка профиля, проверка доступа. Частые ошибки: неверный пароль, блокировка учётной записи.",
      },
    },
    subscribers: ["u-reader", "u-aud"],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 312, helpfulYes: 74, helpfulNo: 12 },
    auditViews: [
      { userId: "u-aud", at: iso(days(-2)) },
      { userId: "u-reader", at: iso(days(-1)) },
    ],
  },
  {
    id: "v-101-1",
    materialId: "m-101",
    version: "0.9",
    createdAt: iso(days(-6)),
    createdBy: "u-author",
    status: "На согласовании",
    passport: {
      title: "Процедура оформления отпуска",
      purpose: "Пошаговая инструкция для сотрудников и руководителей.",
      tags: ["кадры", "отпуск", "hr"],
      tagGroups: [{ group: "HR", tags: ["отпуск", "онбординг"] }],
      criticality: "Средняя",
      sectionId: "sub-leave",
      ownerId: "u-owner",
      legalEntity: "ООО «Альфа»",
      branch: "Москва",
      department: "Операции",
      lastReviewedAt: iso(days(-6)),
      nextReviewAt: iso(days(24)),
      reviewPeriodDays: 30,
    },
    content: {
      kind: "page",
      page: {
        blocks: [
          {
            id: "b1",
            type: "heading",
            text: "Оформление отпуска: общий порядок",
            anchor: "obshchiy-poryadok",
          },
          {
            id: "b2",
            type: "paragraph",
            text: "Подайте заявление минимум за 14 календарных дней. Если требуется перенос — согласуйте с руководителем.",
          },
          {
            id: "b3",
            type: "list",
            text: "1) Согласование дат\n2) Заявление\n3) Подтверждение в системе\n4) Уведомление бухгалтерии",
          },
        ],
      },
    },
    subscribers: [],
    discussionsEnabled: false,
    discussionVisibility: "Все",
    stats: { views: 48, helpfulYes: 9, helpfulNo: 1 },
    auditViews: [],
  },
  {
    id: "v-102-2",
    materialId: "m-102",
    version: "2.0",
    createdAt: iso(days(-2)),
    createdBy: "u-kbadmin",
    changelog: "Переведено в архив в связи с заменой процесса.",
    status: "Архив",
    passport: {
      title: "Порядок выдачи временных пропусков (устарело)",
      purpose: "Справочная информация (архив).",
      tags: ["пропуск", "доступ", "архив"],
      tagGroups: [{ group: "Безопасность", tags: ["доступ"] }],
      criticality: "Низкая",
      sectionId: "sub-accounts",
      legalEntity: "ООО «Альфа" + "»",
      branch: "Москва",
    },
    content: {
      kind: "file",
      file: {
        name: "Пропуска.docx",
        type: "docx",
        extractedText:
          "Временные пропуска: правила оформления, список документов, сроки действия. Данный документ находится в архиве.",
      },
    },
    subscribers: ["u-sec"],
    discussionsEnabled: false,
    discussionVisibility: "Все",
    stats: { views: 7, helpfulYes: 2, helpfulNo: 0 },
    auditViews: [{ userId: "u-sec", at: iso(days(-1)) }],
  },
];

export const rfcs: RFC[] = [
  {
    id: "rfc-1",
    materialId: "m-100",
    createdAt: iso(days(-3)),
    createdBy: "u-reader",
    type: "Проблема",
    title: "Ссылка на ServiceDesk не открывается из VPN",
    description:
      "При переходе по ссылке из инструкции — ошибка сертификата. Нужна проверка актуального URL.",
    status: "В работе",
    assignedTo: "u-owner",
    sla: { reactedAt: iso(days(-3)) },
    comments: [
      {
        id: "c1",
        at: iso(days(-3)),
        by: "u-owner",
        text: "Принято. Проверю и обновлю в следующей версии.",
      },
    ],
  },
];

export const notificationLogSeed: NotificationLog[] = [
  {
    id: "n-1",
    at: iso(days(-5)),
    to: "owner@demo.local",
    subject: "Напоминание: пересмотр материала скоро",
    template: "reminder_before",
    related: { materialId: "m-100", versionId: "v-100-1" },
    status: "LOGGED",
  },
  {
    id: "n-2",
    at: iso(days(-1)),
    to: "auditor@demo.local",
    subject: "Опубликована новая версия: Как подключиться к корпоративному VPN",
    template: "new_version",
    related: { materialId: "m-100", versionId: "v-100-1" },
    status: "LOGGED",
  },
];

export const policySeed = {
  reviewPeriods: [
    { criticality: "Критическая" as Criticality, days: 30, remindBeforeDays: [14, 7, 1], escalationAfterDays: [3, 7] },
    { criticality: "Высокая" as Criticality, days: 90, remindBeforeDays: [14, 7, 1], escalationAfterDays: [7, 14] },
    { criticality: "Средняя" as Criticality, days: 180, remindBeforeDays: [14, 7], escalationAfterDays: [14, 30] },
    { criticality: "Низкая" as Criticality, days: 365, remindBeforeDays: [30, 7], escalationAfterDays: [30, 60] },
  ],
  rbacDefaults: {
    canPublish: ["Администратор", "Владелец"],
    canApprove: ["Администратор", "Владелец", "Заместитель владельца"],
    canEditDraft: ["Автор", "Владелец", "Заместитель владельца", "Администратор"],
    canManagePolicies: ["Администратор"],
    canViewAudit: ["Администратор"],
  },
  adIntegration: {
    enabled: false,
    mode: "demo" as "demo" | "SAML" | "OIDC" | "LDAP",
    mapping: {
      roles: null, // Роли больше не назначаются через AD
      department: "department",
      legalEntity: "company",
      branch: "physicalDeliveryOfficeName",
    },
  },
};
