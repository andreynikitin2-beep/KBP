import { db } from "./db";
import * as schema from "@shared/schema";

const now = new Date();
const days = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d;
};

async function main() {
  console.log("Clearing tables...");

  await db.delete(schema.effectiveVisGroupMap);
  await db.delete(schema.adSyncLog);
  await db.delete(schema.adIntegrationConfig);
  await db.delete(schema.policyRbacDefaults);
  await db.delete(schema.policyReviewPeriods);
  await db.delete(schema.emailTemplates);
  await db.delete(schema.emailConfig);
  await db.delete(schema.notificationLog);
  await db.delete(schema.rfcComments);
  await db.delete(schema.rfcs);
  await db.delete(schema.helpfulRatings);
  await db.delete(schema.viewLog);
  await db.delete(schema.auditViews);
  await db.delete(schema.materialSubscribers);
  await db.delete(schema.materialVersions);
  await db.delete(schema.visibilityGroups);
  await db.delete(schema.catalogNodes);
  await db.delete(schema.users);

  console.log("Seeding users...");
  await db.insert(schema.users).values([
    { id: "u-reader", username: "reader", password: "1", displayName: "Ирина Смирнова", email: "reader@demo.local", roles: ["Читатель"], legalEntity: "ООО «Альфа»", department: "Операции", isAvailable: true, source: "ad", adAccountName: "smirnova_i", lastSyncAt: new Date(Date.now() - 3600_000) },
    { id: "u-author", username: "author", password: "1", displayName: "Алексей Петров", email: "author@demo.local", roles: ["Автор", "Читатель"], legalEntity: "ООО «Альфа»", department: "Процессы", isAvailable: true, source: "ad", adAccountName: "petrov_a", lastSyncAt: new Date(Date.now() - 3600_000) },
    { id: "u-owner", username: "owner", password: "1", displayName: "Мария Иванова", email: "owner@demo.local", roles: ["Владелец", "Автор"], legalEntity: "АО «Бета»", department: "Качество", isAvailable: true, source: "ad", adAccountName: "ivanova_m", lastSyncAt: new Date(Date.now() - 3600_000) },
    { id: "u-deputy", username: "deputy", password: "1", displayName: "Сергей Кузнецов", email: "deputy@demo.local", roles: ["Заместитель владельца"], legalEntity: "АО «Бета»", department: "Качество", isAvailable: false, source: "ad", adAccountName: "kuznetsov_s", lastSyncAt: new Date(Date.now() - 7200_000), deactivatedAt: new Date(Date.now() - 86400_000 * 5) },
    { id: "u-kbadmin", username: "moderator", password: "1", displayName: "Наталья Орлова", email: "moderator@demo.local", roles: ["Администратор"], legalEntity: "ООО «Альфа»", department: "База знаний", isAvailable: true, source: "local" },
    { id: "u-author-owner", username: "volkov", password: "1", displayName: "Дмитрий Волков", email: "volkov@demo.local", roles: ["Автор", "Владелец"], legalEntity: "ООО «Альфа»", department: "Безопасность", isAvailable: true, source: "ad", adAccountName: "volkov_d", lastSyncAt: new Date(Date.now() - 3600_000) },
    { id: "u-reader-author", username: "kozlova", password: "1", displayName: "Елена Козлова", email: "kozlova@demo.local", roles: ["Читатель", "Автор"], legalEntity: "АО «Бета»", department: "Финансы", isAvailable: true, source: "ad", adAccountName: "kozlova_e", lastSyncAt: new Date(Date.now() - 3600_000) },
    { id: "u-sec", username: "secadmin", password: "1", displayName: "Вадим Соколов", email: "secadmin@demo.local", roles: ["Читатель"], legalEntity: "ООО «Альфа»", department: "Безопасность", isAvailable: true, source: "local" },
    { id: "u-aud", username: "auditor", password: "1", displayName: "Ольга Миронова", email: "auditor@demo.local", roles: ["Читатель"], legalEntity: "АО «Бета»", department: "Аудит", isAvailable: true, source: "ad", adAccountName: "mironova_o", lastSyncAt: new Date(Date.now() - 3600_000) },
  ]);

  console.log("Seeding catalog nodes...");
  await db.insert(schema.catalogNodes).values([
    { id: "sec-hr", title: "Кадры и организационные процедуры", type: "section", ownerIds: ["u-owner"] },
    { id: "sub-onb", title: "Онбординг", type: "subsection", parentId: "sec-hr", defaultVisibilityGroupIds: ["g-base"] },
    { id: "sub-leave", title: "Отпуска и отсутствия", type: "subsection", parentId: "sec-hr", defaultVisibilityGroupIds: ["g-hr-confidential"] },
    { id: "sec-it", title: "IT и доступы", type: "section", allowedRoles: ["Автор", "Владелец", "Заместитель владельца", "Администратор", "Читатель"], ownerIds: ["u-author-owner"] },
    { id: "sub-vpn", title: "VPN и удалённый доступ", type: "subsection", parentId: "sec-it", defaultVisibilityGroupIds: ["g-base"] },
    { id: "sub-accounts", title: "Учётные записи", type: "subsection", parentId: "sec-it" },
    { id: "sec-qa", title: "Качество и регламенты", type: "section", ownerIds: ["u-owner", "u-deputy"] },
    { id: "sub-audit", title: "Внутренние проверки", type: "subsection", parentId: "sec-qa" },
    { id: "sec-security", title: "Информационная безопасность", type: "section", allowedRoles: ["Владелец", "Администратор", "Автор"], ownerIds: ["u-author-owner"] },
    { id: "sub-incidents", title: "Инциденты и расследования", type: "subsection", parentId: "sec-security", defaultVisibilityGroupIds: ["g-security"] },
    { id: "sub-compliance", title: "Комплаенс и политики", type: "subsection", parentId: "sec-security", defaultVisibilityGroupIds: ["g-security"] },
  ]);

  const allUserIds = ["u-reader", "u-author", "u-owner", "u-deputy", "u-kbadmin", "u-author-owner", "u-reader-author", "u-sec", "u-aud"];

  console.log("Seeding visibility groups...");
  await db.insert(schema.visibilityGroups).values([
    { id: "g-base", title: "Базовая", isSystem: true, memberIds: allUserIds },
    { id: "g-hr-confidential", title: "HR Конфиденциально", isSystem: false, memberIds: ["u-owner", "u-kbadmin", "u-author-owner"] },
    { id: "g-security", title: "Безопасность и комплаенс", isSystem: false, memberIds: ["u-author-owner", "u-kbadmin", "u-sec"] },
  ]);

  console.log("Seeding material versions...");
  await db.insert(schema.materialVersions).values([
    {
      id: "v-100-1", materialId: "m-100", version: "1.2", createdAt: days(-40), createdBy: "u-owner",
      changelog: "Обновлены скриншоты и срок пересмотра.", status: "Опубликовано",
      title: "Как подключиться к корпоративному VPN", purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ", "удалёнка"],
      tagGroups: [{ group: "IT", tags: ["vpn", "учётка"] }, { group: "Риски", tags: ["безопасность"] }],
      criticality: "Высокая", sectionId: "sub-vpn", ownerId: "u-owner", deputyId: "u-deputy",
      legalEntity: "АО «Бета»", department: "Качество",
      lastReviewedAt: days(-75), nextReviewAt: days(-5), reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
      relatedLinks: [{ label: "Заявка в ServiceDesk", url: "https://example.local/servicedesk" }],
      contentKind: "file",
      contentFile: { name: "VPN_Инструкция.pdf", type: "pdf", extractedText: "VPN инструкция: установка клиента, настройка профиля, проверка доступа. Частые ошибки: неверный пароль, блокировка учётной записи." },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 312, helpfulYes: 74, helpfulNo: 12,
    },
    {
      id: "v-100-0", materialId: "m-100", version: "1.0", createdAt: days(-120), createdBy: "u-author",
      changelog: "Первая публикация инструкции VPN.", status: "Архив",
      title: "Как подключиться к корпоративному VPN", purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ"],
      tagGroups: [{ group: "IT", tags: ["vpn"] }],
      criticality: "Высокая", sectionId: "sub-vpn", ownerId: "u-owner", deputyId: "u-deputy",
      legalEntity: "АО «Бета»", department: "Качество",
      lastReviewedAt: days(-120), nextReviewAt: days(-30), reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
      contentKind: "file",
      contentFile: { name: "VPN_Инструкция_v1.pdf", type: "pdf", extractedText: "VPN инструкция: установка клиента." },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 189, helpfulYes: 42, helpfulNo: 8,
    },
    {
      id: "v-100-prev", materialId: "m-100", version: "1.1", createdAt: days(-80), createdBy: "u-owner",
      changelog: "Добавлены инструкции по 2FA.", status: "Архив",
      title: "Как подключиться к корпоративному VPN", purpose: "Быстрое подключение для удалённой работы.",
      tags: ["vpn", "доступ", "2fa"],
      tagGroups: [{ group: "IT", tags: ["vpn", "учётка"] }],
      criticality: "Высокая", sectionId: "sub-vpn", ownerId: "u-owner", deputyId: "u-deputy",
      legalEntity: "АО «Бета»", department: "Качество",
      lastReviewedAt: days(-80), nextReviewAt: days(-40), reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
      contentKind: "file",
      contentFile: { name: "VPN_Инструкция_v1.1.pdf", type: "pdf", extractedText: "VPN инструкция: установка клиента, настройка профиля, 2FA." },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 245, helpfulYes: 58, helpfulNo: 10,
    },
    {
      id: "v-101-1", materialId: "m-101", version: "0.9", createdAt: days(-6), createdBy: "u-author",
      status: "На согласовании",
      title: "Процедура оформления отпуска", purpose: "Пошаговая инструкция для сотрудников и руководителей.",
      tags: ["кадры", "отпуск", "hr"],
      tagGroups: [{ group: "HR", tags: ["отпуск", "онбординг"] }],
      criticality: "Средняя", sectionId: "sub-leave", ownerId: "u-owner",
      legalEntity: "ООО «Альфа»", department: "Операции",
      lastReviewedAt: days(-6), nextReviewAt: days(24), reviewPeriodDays: 30,
      visibilityGroupIds: ["g-hr-confidential"],
      contentKind: "page",
      contentPage: { html: `<h1>Оформление отпуска: общий порядок</h1><p>Подайте заявление минимум за 14 календарных дней. Если требуется перенос — согласуйте с руководителем.</p><blockquote><p><strong>⚠ Важно:</strong> Заявление необходимо подать не позднее чем за 14 календарных дней до начала отпуска.</p></blockquote><h2>Порядок действий</h2><ol><li>Согласование дат</li><li>Заявление</li><li>Подтверждение в системе</li><li>Уведомление бухгалтерии</li></ol>` },
      discussionsEnabled: false, discussionVisibility: "Все",
      views: 48, helpfulYes: 9, helpfulNo: 1,
    },
    {
      id: "v-102-2", materialId: "m-102", version: "2.0", createdAt: days(-2), createdBy: "u-kbadmin",
      changelog: "Переведено в архив в связи с заменой процесса.", status: "Архив",
      title: "Порядок выдачи временных пропусков (устарело)", purpose: "Справочная информация (архив).",
      tags: ["пропуск", "доступ", "архив"],
      tagGroups: [{ group: "Безопасность", tags: ["доступ"] }],
      criticality: "Низкая", sectionId: "sub-accounts",
      legalEntity: "ООО «Альфа»",
      visibilityGroupIds: ["g-base"],
      contentKind: "file",
      contentFile: { name: "Пропуска.docx", type: "docx", extractedText: "Временные пропуска: правила оформления, список документов, сроки действия. Данный документ находится в архиве." },
      discussionsEnabled: false, discussionVisibility: "Все",
      views: 7, helpfulYes: 2, helpfulNo: 0,
    },
    {
      id: "v-103-1", materialId: "m-103", version: "1.0", createdAt: days(-3), createdBy: "u-author",
      status: "Черновик",
      title: "Инструкция по настройке рабочего места", purpose: "Первичная настройка ПК, установка ПО и подключение к корпоративным сервисам.",
      tags: ["рабочее место", "настройка", "ПО"],
      tagGroups: [{ group: "IT", tags: ["настройка", "ПО"] }],
      criticality: "Средняя", sectionId: "sub-onb", ownerId: "u-author-owner", deputyId: "u-author",
      legalEntity: "ООО «Альфа»", department: "Процессы",
      lastReviewedAt: days(-3), nextReviewAt: days(177), reviewPeriodDays: 180,
      visibilityGroupIds: ["g-base"],
      contentKind: "page",
      contentPage: { html: `<h1>Настройка рабочего места: пошаговая инструкция</h1><p>После получения ноутбука выполните следующие шаги для подключения к корпоративной сети и настройки рабочего окружения.</p><h2>Шаги настройки</h2><ol><li>Подключение к Wi-Fi</li><li>Установка VPN-клиента</li><li>Настройка почты</li><li>Установка корпоративного ПО</li><li>Проверка доступов</li></ol>` },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 5, helpfulYes: 0, helpfulNo: 0,
    },
    {
      id: "v-104-1", materialId: "m-104", version: "1.1", createdAt: days(-15), createdBy: "u-owner",
      changelog: "Обновлён раздел про двухфакторную аутентификацию.", status: "Опубликовано",
      title: "Политика управления учётными записями", purpose: "Правила создания, блокировки и удаления учётных записей сотрудников.",
      tags: ["учётные записи", "безопасность", "политика"],
      tagGroups: [{ group: "IT", tags: ["учётка", "AD"] }, { group: "Безопасность", tags: ["политика"] }],
      criticality: "Критическая", sectionId: "sub-accounts", ownerId: "u-author-owner", deputyId: "u-sec",
      legalEntity: "ООО «Альфа»", department: "Безопасность",
      lastReviewedAt: days(-15), nextReviewAt: days(15), reviewPeriodDays: 30,
      visibilityGroupIds: ["g-base"],
      contentKind: "file",
      contentFile: { name: "Политика_учётных_записей.pdf", type: "pdf", extractedText: "Политика управления учётными записями: создание при приёме на работу, блокировка при увольнении, регулярная проверка неактивных учёток, двухфакторная аутентификация." },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 189, helpfulYes: 45, helpfulNo: 3,
    },
    {
      id: "v-105-1", materialId: "m-105", version: "0.5", createdAt: days(-1), createdBy: "u-reader-author",
      status: "На согласовании",
      title: "Порядок проведения внутренних проверок", purpose: "Регламент подготовки, проведения и документирования внутренних проверок.",
      tags: ["аудит", "проверки", "регламент"],
      tagGroups: [{ group: "Качество", tags: ["аудит", "проверки"] }],
      criticality: "Высокая", sectionId: "sub-audit", ownerId: "u-owner", deputyId: "u-deputy",
      legalEntity: "АО «Бета»", department: "Аудит",
      lastReviewedAt: days(-1), nextReviewAt: days(89), reviewPeriodDays: 90,
      visibilityGroupIds: ["g-base"],
      contentKind: "page",
      contentPage: { html: `<h1>Внутренние проверки: общий регламент</h1><p>Внутренние проверки проводятся ежеквартально. Проверяющая группа формируется приказом генерального директора.</p><h2>Периодичность</h2><p>Плановые проверки — 1 раз в квартал. Внеплановые — по решению руководства.</p>` },
      discussionsEnabled: true, discussionVisibility: "Только владелец/заместитель",
      views: 12, helpfulYes: 3, helpfulNo: 0,
    },
    {
      id: "v-106-1", materialId: "m-106", version: "1.0", createdAt: days(-20), createdBy: "u-author-owner",
      status: "На пересмотре",
      title: "Регламент реагирования на инциденты ИБ", purpose: "Порядок действий при обнаружении инцидентов информационной безопасности.",
      tags: ["инциденты", "ИБ", "безопасность", "реагирование"],
      tagGroups: [{ group: "Безопасность", tags: ["инциденты", "реагирование"] }],
      criticality: "Критическая", sectionId: "sub-incidents", ownerId: "u-author-owner", deputyId: "u-kbadmin",
      legalEntity: "ООО «Альфа»", department: "Безопасность",
      lastReviewedAt: days(-45), nextReviewAt: days(-15), reviewPeriodDays: 30,
      visibilityGroupIds: ["g-security"],
      contentKind: "file",
      contentFile: { name: "Регламент_инцидентов_ИБ.pdf", type: "pdf", extractedText: "Регламент реагирования на инциденты ИБ: классификация инцидентов, порядок эскалации, сроки реагирования, шаблоны отчётов. Категории: утечка данных, несанкционированный доступ, вредоносное ПО." },
      discussionsEnabled: true, discussionVisibility: "Только владелец/заместитель",
      views: 87, helpfulYes: 22, helpfulNo: 1,
    },
    {
      id: "v-107-1", materialId: "m-107", version: "0.3", createdAt: days(-2), createdBy: "u-author-owner",
      status: "Черновик",
      title: "Политика обработки персональных данных", purpose: "Требования к обработке и хранению персональных данных сотрудников и клиентов.",
      tags: ["персональные данные", "GDPR", "комплаенс"],
      tagGroups: [{ group: "Безопасность", tags: ["комплаенс", "ПДн"] }],
      criticality: "Критическая", sectionId: "sub-compliance", ownerId: "u-author-owner",
      legalEntity: "ООО «Альфа»", department: "Безопасность",
      lastReviewedAt: days(-2), nextReviewAt: days(28), reviewPeriodDays: 30,
      visibilityGroupIds: ["g-security"],
      contentKind: "page",
      contentPage: { html: `<h1>Политика обработки персональных данных</h1><p>Все персональные данные должны обрабатываться в соответствии с ФЗ-152 и внутренними регламентами компании.</p><blockquote><p><strong>⚠ Важно:</strong> Нарушение политики обработки ПДн влечёт дисциплинарную и административную ответственность.</p></blockquote>` },
      discussionsEnabled: false, discussionVisibility: "Только владелец/заместитель",
      views: 3, helpfulYes: 0, helpfulNo: 0,
    },
    {
      id: "v-108-1", materialId: "m-108", version: "2.1", createdAt: days(-10), createdBy: "u-owner",
      changelog: "Добавлен раздел про адаптационный трек для удалённых сотрудников.", status: "Опубликовано",
      title: "Чек-лист онбординга нового сотрудника", purpose: "Полный перечень шагов для первого рабочего дня и адаптационного периода.",
      tags: ["онбординг", "адаптация", "чек-лист"],
      tagGroups: [{ group: "HR", tags: ["онбординг", "адаптация"] }],
      criticality: "Средняя", sectionId: "sub-onb", ownerId: "u-owner", deputyId: "u-deputy",
      legalEntity: "АО «Бета»", department: "Качество",
      lastReviewedAt: days(-10), nextReviewAt: days(170), reviewPeriodDays: 180,
      visibilityGroupIds: ["g-hr-confidential"],
      contentKind: "page",
      contentPage: { html: `<h1>Онбординг: чек-лист для HR и руководителя</h1><p>Подготовьте рабочее место, доступы и адаптационный план до выхода сотрудника.</p><h2>Чек-лист</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><span>Оформление документов</span></label></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /><span>Настройка рабочего места</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Знакомство с командой</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Назначение наставника</span></label></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span>Адаптационный трек (2 недели)</span></label></li></ul><h2>Таблица сроков</h2><table><tr><th>Этап</th><th>Срок</th><th>Ответственный</th></tr><tr><td>Документы</td><td>День 1</td><td>HR</td></tr><tr><td>Рабочее место</td><td>День 1</td><td>IT</td></tr><tr><td>Наставник</td><td>День 2-3</td><td>Руководитель</td></tr></table>` },
      discussionsEnabled: true, discussionVisibility: "Все",
      views: 256, helpfulYes: 67, helpfulNo: 4,
    },
  ]);

  console.log("Seeding material subscribers...");
  const subscriberRows: { materialId: string; userId: string }[] = [];
  const materialSubscriberData: [string, string[]][] = [
    ["m-100", ["u-reader", "u-aud"]],
    ["m-100", ["u-reader"]],
    ["m-102", ["u-sec"]],
    ["m-104", ["u-sec", "u-kbadmin"]],
    ["m-105", ["u-aud"]],
    ["m-106", ["u-sec", "u-kbadmin"]],
    ["m-108", ["u-reader-author"]],
  ];
  const seenSubscribers = new Set<string>();
  for (const [materialId, subs] of materialSubscriberData) {
    for (const userId of subs) {
      const key = `${materialId}:${userId}`;
      if (!seenSubscribers.has(key)) {
        seenSubscribers.add(key);
        subscriberRows.push({ materialId, userId });
      }
    }
  }
  if (subscriberRows.length > 0) {
    await db.insert(schema.materialSubscribers).values(subscriberRows);
  }

  console.log("Seeding audit views...");
  const auditViewRows: { materialId: string; userId: string; viewedAt: Date }[] = [
    { materialId: "m-100", userId: "u-aud", viewedAt: days(-2) },
    { materialId: "m-100", userId: "u-reader", viewedAt: days(-1) },
    { materialId: "m-102", userId: "u-sec", viewedAt: days(-1) },
    { materialId: "m-104", userId: "u-sec", viewedAt: days(-1) },
    { materialId: "m-106", userId: "u-sec", viewedAt: days(-3) },
    { materialId: "m-108", userId: "u-aud", viewedAt: days(-5) },
  ];
  await db.insert(schema.auditViews).values(auditViewRows);

  console.log("Seeding RFCs...");
  await db.insert(schema.rfcs).values([
    {
      id: "rfc-1", materialId: "m-100", createdAt: days(-3), createdBy: "u-reader",
      type: "Проблема", title: "Ссылка на ServiceDesk не открывается из VPN",
      description: "При переходе по ссылке из инструкции — ошибка сертификата. Нужна проверка актуального URL.",
      status: "В работе", assignedTo: "u-owner",
      slaReactedAt: days(-3),
    },
    {
      id: "rfc-2", materialId: "m-104", createdAt: days(-7), createdBy: "u-sec",
      type: "Предложение", title: "Добавить раздел про аппаратные токены",
      description: "В политике не описан порядок выдачи и использования аппаратных токенов для 2FA. Предлагаю добавить.",
      status: "Новый", assignedTo: "u-author-owner",
    },
    {
      id: "rfc-3", materialId: "m-106", createdAt: days(-5), createdBy: "u-kbadmin",
      type: "Проблема", title: "Устаревшие контакты в разделе эскалации",
      description: "Телефон дежурного ИБ-специалиста изменился. Необходимо обновить контактные данные.",
      status: "В работе", assignedTo: "u-author-owner",
      slaReactedAt: days(-4),
    },
  ]);

  console.log("Seeding RFC comments...");
  await db.insert(schema.rfcComments).values([
    { rfcId: "rfc-1", createdAt: days(-3), createdBy: "u-owner", text: "Принято. Проверю и обновлю в следующей версии." },
    { rfcId: "rfc-3", createdAt: days(-4), createdBy: "u-author-owner", text: "Обновлю при следующем пересмотре, который уже просрочен." },
  ]);

  console.log("Seeding notification log...");
  await db.insert(schema.notificationLog).values([
    { id: "n-1", toAddress: "owner@demo.local", subject: "Напоминание: пересмотр материала скоро", template: "reminder_before", relatedMaterialId: "m-100", relatedVersionId: "v-100-1", status: "LOGGED" },
    { id: "n-2", toAddress: "auditor@demo.local", subject: "Опубликована новая версия: Как подключиться к корпоративному VPN", template: "new_version", relatedMaterialId: "m-100", relatedVersionId: "v-100-1", status: "LOGGED" },
    { id: "n-3", toAddress: "volkov@demo.local", subject: "Просрочен пересмотр: Регламент реагирования на инциденты ИБ", template: "overdue", relatedMaterialId: "m-106", relatedVersionId: "v-106-1", status: "LOGGED" },
    { id: "n-4", toAddress: "volkov@demo.local", subject: "Новый RFC: Добавить раздел про аппаратные токены", template: "new_version", relatedMaterialId: "m-104", relatedRfcId: "rfc-2", status: "LOGGED" },
    { id: "n-5", toAddress: "owner@demo.local", subject: "Материал на согласовании: Порядок проведения внутренних проверок", template: "new_version", relatedMaterialId: "m-105", relatedVersionId: "v-105-1", status: "LOGGED" },
    { id: "n-6", toAddress: "moderator@demo.local", subject: "Ошибка отправки уведомления: шаблон escalation", template: "escalation", relatedMaterialId: "m-106", status: "FAILED" },
  ]);

  console.log("Seeding email config...");
  await db.insert(schema.emailConfig).values({
    senderAddress: "kb-portal@progorod.veb.ru",
    senderName: "Портал инструкций",
    smtpHost: "smtp.progorod.veb.ru",
    smtpPort: 587,
    smtpUser: "kb-portal",
    smtpPassword: "",
    smtpUseTls: true,
    enabled: true,
  });

  console.log("Seeding email templates...");
  await db.insert(schema.emailTemplates).values([
    { key: "reminder_before", label: "Напоминание до срока", subject: "Напоминание: пересмотр «{{title}}» через {{days}} дн.", body: "Уважаемый(ая) {{owner}},\n\nНапоминаем, что срок пересмотра материала «{{title}}» наступает через {{days}} дней ({{dueDate}}).\n\nПожалуйста, подтвердите актуальность или внесите необходимые изменения.\n\nСсылка: {{link}}", description: "Отправляется владельцу до наступления срока пересмотра" },
    { key: "reminder_due", label: "Срок пересмотра наступил", subject: "Пересмотр: срок актуальности «{{title}}» истёк", body: "Уважаемый(ая) {{owner}},\n\nСрок актуальности материала «{{title}}» истёк {{dueDate}}.\n\nНеобходимо подтвердить актуальность или создать новую версию.\n\nСсылка: {{link}}", description: "Отправляется владельцу при наступлении срока пересмотра" },
    { key: "overdue", label: "Просрочка пересмотра", subject: "Просрочка: «{{title}}» — пересмотр не выполнен", body: "Уважаемый(ая) {{owner}},\n\nМатериал «{{title}}» просрочен: срок пересмотра истёк {{dueDate}}.\n\nМатериал будет переведён в статус «На пересмотре» если не будет подтверждён.\n\nСсылка: {{link}}", description: "Отправляется при просрочке пересмотра материала" },
    { key: "escalation", label: "Эскалация", subject: "Эскалация: «{{title}}» — требуется вмешательство", body: "Уважаемый(ая) администратор,\n\nМатериал «{{title}}» (владелец: {{owner}}) просрочен более {{days}} дней.\n\nТребуется вмешательство для решения вопроса актуальности.\n\nСсылка: {{link}}", description: "Эскалация администратору при длительной просрочке" },
    { key: "new_version", label: "Новая версия опубликована", subject: "Новая версия: «{{title}}» v{{version}}", body: "Уважаемый(ая) {{recipient}},\n\nОпубликована новая версия материала «{{title}}» (v{{version}}).\n\nОсновные изменения: {{changelog}}\n\nСсылка: {{link}}", description: "Уведомление подписчикам при публикации новой версии" },
    { key: "auto_transition", label: "Автоматический переход статуса", subject: "Статус изменён: «{{title}}» → {{newStatus}}", body: "Уважаемый(ая) {{owner}},\n\nСтатус материала «{{title}}» автоматически изменён на «{{newStatus}}».\n\nПричина: {{reason}}\n\nСсылка: {{link}}", description: "Уведомление при автоматическом изменении статуса материала" },
  ]);

  console.log("Seeding policy review periods...");
  await db.insert(schema.policyReviewPeriods).values([
    { criticality: "Критическая", days: 30, remindBeforeDays: [14, 7, 1], escalationAfterDays: [3, 7] },
    { criticality: "Высокая", days: 90, remindBeforeDays: [14, 7, 1], escalationAfterDays: [7, 14] },
    { criticality: "Средняя", days: 180, remindBeforeDays: [14, 7], escalationAfterDays: [14, 30] },
    { criticality: "Низкая", days: 365, remindBeforeDays: [30, 7], escalationAfterDays: [30, 60] },
  ]);

  console.log("Seeding policy RBAC defaults...");
  await db.insert(schema.policyRbacDefaults).values([
    { key: "canPublish", roles: ["Администратор", "Владелец"] },
    { key: "canApprove", roles: ["Администратор", "Владелец", "Заместитель владельца"] },
    { key: "canEditDraft", roles: ["Автор", "Владелец", "Заместитель владельца", "Администратор"] },
    { key: "canManagePolicies", roles: ["Администратор"] },
    { key: "canViewAudit", roles: ["Администратор"] },
  ]);

  console.log("Seeding AD integration config...");
  await db.insert(schema.adIntegrationConfig).values({
    enabled: true,
    mode: "SAML",
    ssoUrl: "https://sso.example.com/saml2",
    syncFrequencyMinutes: 60,
    lastSyncAt: new Date(Date.now() - 3600_000),
    syncStatus: "success",
    syncedUsersCount: 7,
    deactivatedCount: 1,
    mappingRoles: null,
    mappingDepartment: "department",
    mappingLegalEntity: "company",
    mappingDisplayName: "displayName",
    mappingEmail: "mail",
  });

  console.log("Seeding AD sync log...");
  await db.insert(schema.adSyncLog).values([
    { syncedAt: new Date(Date.now() - 3600_000), status: "success", usersTotal: 7, usersUpdated: 1, usersDeactivated: 0, message: "Синхронизация завершена успешно" },
    { syncedAt: new Date(Date.now() - 7200_000), status: "success", usersTotal: 7, usersUpdated: 0, usersDeactivated: 1, message: "Деактивирован: Кузнецов С. (kuznetsov_s)" },
    { syncedAt: new Date(Date.now() - 86400_000), status: "success", usersTotal: 8, usersUpdated: 2, usersDeactivated: 0, message: "Синхронизация завершена успешно" },
  ]);

  console.log("Seeding effective visibility group map...");
  await db.insert(schema.effectiveVisGroupMap).values([
    { materialId: "m-100", visibilityGroupIds: ["g-base"] },
    { materialId: "m-104", visibilityGroupIds: ["g-base"] },
    { materialId: "m-106", visibilityGroupIds: ["g-security"] },
    { materialId: "m-108", visibilityGroupIds: ["g-hr-confidential"] },
  ]);

  console.log("Seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
