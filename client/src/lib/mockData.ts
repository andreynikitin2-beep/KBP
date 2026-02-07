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

export type UserSource = "ad" | "local";

export type User = {
  id: string;
  displayName: string;
  email: string;
  roles: Role[];
  legalEntity: string;
  department: string;
  isAvailable: boolean;
  source: UserSource;
  adAccountName?: string;
  lastSyncAt?: string;
  deactivatedAt?: string;
};

export type CatalogNode = {
  id: string;
  title: string;
  type: "section" | "subsection";
  parentId?: string;
  allowedRoles?: Role[];
  ownerIds?: string[];
  defaultVisibilityGroupIds?: string[];
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
  department?: string;
  requiredTraining?: boolean;
  relatedLinks?: { label: string; url: string }[];
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewPeriodDays?: number;
  visibilityGroupIds: string[];
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
    page?: { html: string };
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
    department: "Операции",
    isAvailable: true,
    source: "ad",
    adAccountName: "smirnova_i",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "u-author",
    displayName: "Алексей Петров",
    email: "author@demo.local",
    roles: ["Автор", "Читатель"],
    legalEntity: "ООО «Альфа»",
    department: "Процессы",
    isAvailable: true,
    source: "ad",
    adAccountName: "petrov_a",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "u-owner",
    displayName: "Мария Иванова",
    email: "owner@demo.local",
    roles: ["Владелец", "Автор"],
    legalEntity: "АО «Бета»",
    department: "Качество",
    isAvailable: true,
    source: "ad",
    adAccountName: "ivanova_m",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "u-deputy",
    displayName: "Сергей Кузнецов",
    email: "deputy@demo.local",
    roles: ["Заместитель владельца"],
    legalEntity: "АО «Бета»",
    department: "Качество",
    isAvailable: false,
    source: "ad",
    adAccountName: "kuznetsov_s",
    lastSyncAt: new Date(Date.now() - 7200_000).toISOString(),
    deactivatedAt: new Date(Date.now() - 86400_000 * 5).toISOString(),
  },
  {
    id: "u-kbadmin",
    displayName: "Наталья Орлова",
    email: "moderator@demo.local",
    roles: ["Администратор"],
    legalEntity: "ООО «Альфа»",
    department: "База знаний",
    isAvailable: true,
    source: "local",
  },
  {
    id: "u-author-owner",
    displayName: "Дмитрий Волков",
    email: "volkov@demo.local",
    roles: ["Автор", "Владелец"],
    legalEntity: "ООО «Альфа»",
    department: "Безопасность",
    isAvailable: true,
    source: "ad",
    adAccountName: "volkov_d",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "u-reader-author",
    displayName: "Елена Козлова",
    email: "kozlova@demo.local",
    roles: ["Читатель", "Автор"],
    legalEntity: "АО «Бета»",
    department: "Финансы",
    isAvailable: true,
    source: "ad",
    adAccountName: "kozlova_e",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "u-sec",
    displayName: "Вадим Соколов",
    email: "secadmin@demo.local",
    roles: ["Читатель"],
    legalEntity: "ООО «Альфа»",
    department: "Безопасность",
    isAvailable: true,
    source: "local",
  },
  {
    id: "u-aud",
    displayName: "Ольга Миронова",
    email: "auditor@demo.local",
    roles: ["Читатель"],
    legalEntity: "АО «Бета»",
    department: "Аудит",
    isAvailable: true,
    source: "ad",
    adAccountName: "mironova_o",
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
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
    memberIds: ["u-owner", "u-kbadmin", "u-author-owner"],
  },
  {
    id: "g-security",
    title: "Безопасность и комплаенс",
    isSystem: false,
    memberIds: ["u-author-owner", "u-kbadmin", "u-sec"],
  },
];

export const catalog: CatalogNode[] = [
  {
    id: "sec-hr",
    title: "Кадры и организационные процедуры",
    type: "section",
    ownerIds: ["u-owner"],
  },
  {
    id: "sub-onb",
    title: "Онбординг",
    type: "subsection",
    parentId: "sec-hr",
    defaultVisibilityGroupIds: ["g-base"],
  },
  {
    id: "sub-leave",
    title: "Отпуска и отсутствия",
    type: "subsection",
    parentId: "sec-hr",
    defaultVisibilityGroupIds: ["g-hr-confidential"],
  },
  {
    id: "sec-it",
    title: "IT и доступы",
    type: "section",
    allowedRoles: ["Автор", "Владелец", "Заместитель владельца", "Администратор", "Читатель"],
    ownerIds: ["u-author-owner"],
  },
  {
    id: "sub-vpn",
    title: "VPN и удалённый доступ",
    type: "subsection",
    parentId: "sec-it",
    defaultVisibilityGroupIds: ["g-base"],
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
    ownerIds: ["u-owner", "u-deputy"],
  },
  {
    id: "sub-audit",
    title: "Внутренние проверки",
    type: "subsection",
    parentId: "sec-qa",
  },
  {
    id: "sec-security",
    title: "Информационная безопасность",
    type: "section",
    allowedRoles: ["Владелец", "Администратор", "Автор"],
    ownerIds: ["u-author-owner"],
  },
  {
    id: "sub-incidents",
    title: "Инциденты и расследования",
    type: "subsection",
    parentId: "sec-security",
    defaultVisibilityGroupIds: ["g-security"],
  },
  {
    id: "sub-compliance",
    title: "Комплаенс и политики",
    type: "subsection",
    parentId: "sec-security",
    defaultVisibilityGroupIds: ["g-security"],
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
      department: "Качество",
      lastReviewedAt: iso(days(-75)),
      nextReviewAt: iso(days(-5)),
      reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
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
    id: "v-100-0",
    materialId: "m-100",
    version: "1.0",
    createdAt: iso(days(-120)),
    createdBy: "u-author",
    changelog: "Первая публикация инструкции VPN.",
    status: "Архив",
    passport: {
      title: "Как подключиться к корпоративному VPN",
      purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ"],
      tagGroups: [{ group: "IT", tags: ["vpn"] }],
      criticality: "Высокая",
      sectionId: "sub-vpn",
      ownerId: "u-owner",
      deputyId: "u-deputy",
      legalEntity: "АО «Бета»",
      department: "Качество",
      lastReviewedAt: iso(days(-120)),
      nextReviewAt: iso(days(-30)),
      reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
    },
    content: {
      kind: "file",
      file: { name: "VPN_Инструкция_v1.pdf", type: "pdf", extractedText: "VPN инструкция: установка клиента." },
    },
    subscribers: [],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 189, helpfulYes: 42, helpfulNo: 8 },
    auditViews: [],
  },
  {
    id: "v-100-prev",
    materialId: "m-100",
    version: "1.1",
    createdAt: iso(days(-80)),
    createdBy: "u-owner",
    changelog: "Добавлены инструкции по 2FA.",
    status: "Архив",
    passport: {
      title: "Как подключиться к корпоративному VPN",
      purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ", "2fa"],
      tagGroups: [{ group: "IT", tags: ["vpn", "учётка"] }],
      criticality: "Высокая",
      sectionId: "sub-vpn",
      ownerId: "u-owner",
      deputyId: "u-deputy",
      legalEntity: "АО «Бета»",
      department: "Качество",
      lastReviewedAt: iso(days(-80)),
      nextReviewAt: iso(days(-40)),
      reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
    },
    content: {
      kind: "file",
      file: { name: "VPN_Инструкция_v1.1.pdf", type: "pdf", extractedText: "VPN инструкция: установка клиента, настройка профиля, 2FA." },
    },
    subscribers: ["u-reader"],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 245, helpfulYes: 58, helpfulNo: 10 },
    auditViews: [],
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
      department: "Операции",
      lastReviewedAt: iso(days(-6)),
      nextReviewAt: iso(days(24)),
      reviewPeriodDays: 30,
      visibilityGroupIds: ["g-hr-confidential"],
    },
    content: {
      kind: "page",
      page: {
        html: `<h1>Оформление отпуска: общий порядок</h1><p>Подайте заявление минимум за 14 календарных дней. Если требуется перенос — согласуйте с руководителем.</p><blockquote><p><strong>⚠ Важно:</strong> Заявление необходимо подать не позднее чем за 14 календарных дней до начала отпуска.</p></blockquote><h2>Порядок действий</h2><ol><li>Согласование дат</li><li>Заявление</li><li>Подтверждение в системе</li><li>Уведомление бухгалтерии</li></ol>`,
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
      legalEntity: "ООО «Альфа»",
      visibilityGroupIds: ["g-base"],
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
  {
    id: "v-103-1",
    materialId: "m-103",
    version: "1.0",
    createdAt: iso(days(-3)),
    createdBy: "u-author",
    status: "Черновик",
    passport: {
      title: "Инструкция по настройке рабочего места",
      purpose: "Первичная настройка ПК, установка ПО и подключение к корпоративным сервисам.",
      tags: ["рабочее место", "настройка", "ПО"],
      tagGroups: [{ group: "IT", tags: ["настройка", "ПО"] }],
      criticality: "Средняя",
      sectionId: "sub-onb",
      ownerId: "u-author-owner",
      deputyId: "u-author",
      legalEntity: "ООО «Альфа»",
      department: "Процессы",
      lastReviewedAt: iso(days(-3)),
      nextReviewAt: iso(days(177)),
      reviewPeriodDays: 180,
      visibilityGroupIds: ["g-base"],
    },
    content: {
      kind: "page",
      page: {
        html: `<h1>Настройка рабочего места: пошаговая инструкция</h1><p>После получения ноутбука выполните следующие шаги для подключения к корпоративной сети и настройки рабочего окружения.</p><h2>Шаги настройки</h2><ol><li>Подключение к Wi-Fi</li><li>Установка VPN-клиента</li><li>Настройка почты</li><li>Установка корпоративного ПО</li><li>Проверка доступов</li></ol>`,
      },
    },
    subscribers: [],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 5, helpfulYes: 0, helpfulNo: 0 },
    auditViews: [],
  },
  {
    id: "v-104-1",
    materialId: "m-104",
    version: "1.1",
    createdAt: iso(days(-15)),
    createdBy: "u-owner",
    changelog: "Обновлён раздел про двухфакторную аутентификацию.",
    status: "Опубликовано",
    passport: {
      title: "Политика управления учётными записями",
      purpose: "Правила создания, блокировки и удаления учётных записей сотрудников.",
      tags: ["учётные записи", "безопасность", "политика"],
      tagGroups: [{ group: "IT", tags: ["учётка", "AD"] }, { group: "Безопасность", tags: ["политика"] }],
      criticality: "Критическая",
      sectionId: "sub-accounts",
      ownerId: "u-author-owner",
      deputyId: "u-sec",
      legalEntity: "ООО «Альфа»",
      department: "Безопасность",
      lastReviewedAt: iso(days(-15)),
      nextReviewAt: iso(days(15)),
      reviewPeriodDays: 30,
      visibilityGroupIds: ["g-base"],
    },
    content: {
      kind: "file",
      file: {
        name: "Политика_учётных_записей.pdf",
        type: "pdf",
        extractedText: "Политика управления учётными записями: создание при приёме на работу, блокировка при увольнении, регулярная проверка неактивных учёток, двухфакторная аутентификация.",
      },
    },
    subscribers: ["u-sec", "u-kbadmin"],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 189, helpfulYes: 45, helpfulNo: 3 },
    auditViews: [{ userId: "u-sec", at: iso(days(-1)) }],
  },
  {
    id: "v-105-1",
    materialId: "m-105",
    version: "0.5",
    createdAt: iso(days(-1)),
    createdBy: "u-reader-author",
    status: "На согласовании",
    passport: {
      title: "Порядок проведения внутренних проверок",
      purpose: "Регламент подготовки, проведения и документирования внутренних проверок.",
      tags: ["аудит", "проверки", "регламент"],
      tagGroups: [{ group: "Качество", tags: ["аудит", "проверки"] }],
      criticality: "Высокая",
      sectionId: "sub-audit",
      ownerId: "u-owner",
      deputyId: "u-deputy",
      legalEntity: "АО «Бета»",
      department: "Аудит",
      lastReviewedAt: iso(days(-1)),
      nextReviewAt: iso(days(89)),
      reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
    },
    content: {
      kind: "page",
      page: {
        html: `<h1>Внутренние проверки: общий регламент</h1><p>Внутренние проверки проводятся ежеквартально. Проверяющая группа формируется приказом генерального директора.</p><h2>Периодичность</h2><p>Плановые проверки — 1 раз в квартал. Внеплановые — по решению руководства.</p>`,
      },
    },
    subscribers: ["u-aud"],
    discussionsEnabled: true,
    discussionVisibility: "Только владелец/заместитель",
    stats: { views: 12, helpfulYes: 3, helpfulNo: 0 },
    auditViews: [],
  },
  {
    id: "v-106-1",
    materialId: "m-106",
    version: "1.0",
    createdAt: iso(days(-20)),
    createdBy: "u-author-owner",
    status: "На пересмотре",
    passport: {
      title: "Регламент реагирования на инциденты ИБ",
      purpose: "Порядок действий при обнаружении инцидентов информационной безопасности.",
      tags: ["инциденты", "ИБ", "безопасность", "реагирование"],
      tagGroups: [{ group: "Безопасность", tags: ["инциденты", "реагирование"] }],
      criticality: "Критическая",
      sectionId: "sub-incidents",
      ownerId: "u-author-owner",
      deputyId: "u-kbadmin",
      legalEntity: "ООО «Альфа»",
      department: "Безопасность",
      lastReviewedAt: iso(days(-45)),
      nextReviewAt: iso(days(-15)),
      reviewPeriodDays: 30,
      visibilityGroupIds: ["g-security"],
    },
    content: {
      kind: "file",
      file: {
        name: "Регламент_инцидентов_ИБ.pdf",
        type: "pdf",
        extractedText: "Регламент реагирования на инциденты ИБ: классификация инцидентов, порядок эскалации, сроки реагирования, шаблоны отчётов. Категории: утечка данных, несанкционированный доступ, вредоносное ПО.",
      },
    },
    subscribers: ["u-sec", "u-kbadmin"],
    discussionsEnabled: true,
    discussionVisibility: "Только владелец/заместитель",
    stats: { views: 87, helpfulYes: 22, helpfulNo: 1 },
    auditViews: [{ userId: "u-sec", at: iso(days(-3)) }],
  },
  {
    id: "v-107-1",
    materialId: "m-107",
    version: "0.3",
    createdAt: iso(days(-2)),
    createdBy: "u-author-owner",
    status: "Черновик",
    passport: {
      title: "Политика обработки персональных данных",
      purpose: "Требования к обработке и хранению персональных данных сотрудников и клиентов.",
      tags: ["персональные данные", "GDPR", "комплаенс"],
      tagGroups: [{ group: "Безопасность", tags: ["комплаенс", "ПДн"] }],
      criticality: "Критическая",
      sectionId: "sub-compliance",
      ownerId: "u-author-owner",
      legalEntity: "ООО «Альфа»",
      department: "Безопасность",
      lastReviewedAt: iso(days(-2)),
      nextReviewAt: iso(days(28)),
      reviewPeriodDays: 30,
      visibilityGroupIds: ["g-security"],
    },
    content: {
      kind: "page",
      page: {
        html: `<h1>Политика обработки персональных данных</h1><p>Все персональные данные должны обрабатываться в соответствии с ФЗ-152 и внутренними регламентами компании.</p><blockquote><p><strong>⚠ Важно:</strong> Нарушение политики обработки ПДн влечёт дисциплинарную и административную ответственность.</p></blockquote>`,
      },
    },
    subscribers: [],
    discussionsEnabled: false,
    discussionVisibility: "Только владелец/заместитель",
    stats: { views: 3, helpfulYes: 0, helpfulNo: 0 },
    auditViews: [],
  },
  {
    id: "v-108-1",
    materialId: "m-108",
    version: "2.1",
    createdAt: iso(days(-10)),
    createdBy: "u-owner",
    changelog: "Добавлен раздел про адаптационный трек для удалённых сотрудников.",
    status: "Опубликовано",
    passport: {
      title: "Чек-лист онбординга нового сотрудника",
      purpose: "Полный перечень шагов для первого рабочего дня и адаптационного периода.",
      tags: ["онбординг", "адаптация", "чек-лист"],
      tagGroups: [{ group: "HR", tags: ["онбординг", "адаптация"] }],
      criticality: "Средняя",
      sectionId: "sub-onb",
      ownerId: "u-owner",
      deputyId: "u-deputy",
      legalEntity: "АО «Бета»",
      department: "Качество",
      lastReviewedAt: iso(days(-10)),
      nextReviewAt: iso(days(170)),
      reviewPeriodDays: 180,
      visibilityGroupIds: ["g-hr-confidential"],
    },
    content: {
      kind: "page",
      page: {
        html: `<h1>Онбординг: чек-лист для HR и руководителя</h1><p>Подготовьте рабочее место, доступы и адаптационный план до выхода сотрудника.</p><h2>Чек-лист</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><span>Оформление документов</span></label></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><span>Настройка рабочего места</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Знакомство с командой</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Назначение наставника</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Адаптационный трек (2 недели)</span></label></li></ul><h2>Таблица сроков</h2><table><tr><th>Этап</th><th>Срок</th><th>Ответственный</th></tr><tr><td>Документы</td><td>День 1</td><td>HR</td></tr><tr><td>Рабочее место</td><td>День 1</td><td>IT</td></tr><tr><td>Наставник</td><td>День 2-3</td><td>Руководитель</td></tr></table>`,
      },
    },
    subscribers: ["u-reader-author"],
    discussionsEnabled: true,
    discussionVisibility: "Все",
    stats: { views: 256, helpfulYes: 67, helpfulNo: 4 },
    auditViews: [{ userId: "u-aud", at: iso(days(-5)) }],
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
  {
    id: "rfc-2",
    materialId: "m-104",
    createdAt: iso(days(-7)),
    createdBy: "u-sec",
    type: "Предложение",
    title: "Добавить раздел про аппаратные токены",
    description: "В политике не описан порядок выдачи и использования аппаратных токенов для 2FA. Предлагаю добавить.",
    status: "Новый",
    assignedTo: "u-author-owner",
    sla: {},
    comments: [],
  },
  {
    id: "rfc-3",
    materialId: "m-106",
    createdAt: iso(days(-5)),
    createdBy: "u-kbadmin",
    type: "Проблема",
    title: "Устаревшие контакты в разделе эскалации",
    description: "Телефон дежурного ИБ-специалиста изменился. Необходимо обновить контактные данные.",
    status: "В работе",
    assignedTo: "u-author-owner",
    sla: { reactedAt: iso(days(-4)) },
    comments: [
      {
        id: "c2",
        at: iso(days(-4)),
        by: "u-author-owner",
        text: "Обновлю при следующем пересмотре, который уже просрочен.",
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
  {
    id: "n-3",
    at: iso(days(-15)),
    to: "volkov@demo.local",
    subject: "Просрочен пересмотр: Регламент реагирования на инциденты ИБ",
    template: "overdue",
    related: { materialId: "m-106", versionId: "v-106-1" },
    status: "LOGGED",
  },
  {
    id: "n-4",
    at: iso(days(-7)),
    to: "volkov@demo.local",
    subject: "Новый RFC: Добавить раздел про аппаратные токены",
    template: "new_version",
    related: { materialId: "m-104", rfcId: "rfc-2" },
    status: "LOGGED",
  },
  {
    id: "n-5",
    at: iso(days(-1)),
    to: "owner@demo.local",
    subject: "Материал на согласовании: Порядок проведения внутренних проверок",
    template: "new_version",
    related: { materialId: "m-105", versionId: "v-105-1" },
    status: "LOGGED",
  },
  {
    id: "n-6",
    at: iso(days(0)),
    to: "moderator@demo.local",
    subject: "Ошибка отправки уведомления: шаблон escalation",
    template: "escalation",
    related: { materialId: "m-106" },
    status: "FAILED",
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
    enabled: true,
    mode: "SAML" as "demo" | "SAML" | "OIDC" | "LDAP",
    ssoUrl: "https://sso.example.com/saml2",
    syncFrequencyMinutes: 60,
    lastSyncAt: new Date(Date.now() - 3600_000).toISOString(),
    syncStatus: "success" as "success" | "error" | "in_progress" | "never",
    syncedUsersCount: 7,
    deactivatedCount: 1,
    mapping: {
      roles: null,
      department: "department",
      legalEntity: "company",
      displayName: "displayName",
      email: "mail",
    },
    syncLog: [
      { at: new Date(Date.now() - 3600_000).toISOString(), status: "success" as "success" | "error", usersTotal: 7, usersUpdated: 1, usersDeactivated: 0, message: "Синхронизация завершена успешно" },
      { at: new Date(Date.now() - 7200_000).toISOString(), status: "success" as "success" | "error", usersTotal: 7, usersUpdated: 0, usersDeactivated: 1, message: "Деактивирован: Кузнецов С. (kuznetsov_s)" },
      { at: new Date(Date.now() - 86400_000).toISOString(), status: "success" as "success" | "error", usersTotal: 8, usersUpdated: 2, usersDeactivated: 0, message: "Синхронизация завершена успешно" },
    ],
  },
};
