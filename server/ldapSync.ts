import ldap from "ldapjs";
import { storage } from "./storage";

interface LdapConfig {
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  mappingDisplayName: string;
  mappingEmail: string;
  mappingDepartment: string;
  mappingLegalEntity: string;
  mappingRoles: string | null;
}

interface LdapUserEntry {
  dn: string;
  sAMAccountName: string;
  displayName: string;
  email: string;
  department: string;
  legalEntity: string;
}

function getAttr(entry: any, attrName: string): string {
  if (!attrName) return "";
  try {
    const val = entry.ppiAttributes?.[attrName]
      ?? entry.attributes?.find?.((a: any) => a.type === attrName)?.values?.[0]
      ?? "";
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] ?? "" : String(val);
  } catch {
    return "";
  }
}

function parseLdapEntry(entry: any, config: LdapConfig): LdapUserEntry {
  const raw = entry.ppiObject ?? entry.object ?? {};
  const attrs: Record<string, string> = {};

  if (entry.attributes && Array.isArray(entry.attributes)) {
    for (const attr of entry.attributes) {
      const key = attr.type ?? attr._name;
      const vals = attr._vals ?? attr.values ?? attr.vals;
      if (key && vals) {
        attrs[key.toLowerCase()] = Array.isArray(vals)
          ? (vals[0]?.toString?.() ?? String(vals[0] ?? ""))
          : String(vals);
      }
    }
  }

  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (!attrs[k.toLowerCase()]) {
        attrs[k.toLowerCase()] = typeof v === "string" ? v : String(v ?? "");
      }
    }
  }

  function get(mapping: string): string {
    if (!mapping) return "";
    return attrs[mapping.toLowerCase()] ?? "";
  }

  return {
    dn: entry.dn ?? raw.dn ?? "",
    sAMAccountName: attrs["samaccountname"] ?? attrs["uid"] ?? attrs["cn"] ?? "",
    displayName: get(config.mappingDisplayName) || attrs["displayname"] || attrs["cn"] || "",
    email: get(config.mappingEmail) || attrs["mail"] || attrs["userprincipalname"] || "",
    department: get(config.mappingDepartment) || attrs["department"] || "",
    legalEntity: get(config.mappingLegalEntity) || attrs["company"] || attrs["o"] || "",
  };
}

export async function performLdapSync(): Promise<{
  ok: boolean;
  message: string;
  usersTotal: number;
  usersUpdated: number;
  usersCreated: number;
  usersDeactivated: number;
}> {
  const adConfig = await storage.getAdIntegrationConfig();
  if (!adConfig) {
    return { ok: false, message: "Конфигурация AD не найдена", usersTotal: 0, usersUpdated: 0, usersCreated: 0, usersDeactivated: 0 };
  }

  if (!adConfig.enabled) {
    return { ok: false, message: "Интеграция AD/SSO выключена", usersTotal: 0, usersUpdated: 0, usersCreated: 0, usersDeactivated: 0 };
  }

  if (adConfig.mode !== "LDAP") {
    return { ok: false, message: "Режим интеграции не LDAP", usersTotal: 0, usersUpdated: 0, usersCreated: 0, usersDeactivated: 0 };
  }

  if (!adConfig.ssoUrl || !adConfig.bindDn || !adConfig.bindPassword || !adConfig.baseDn) {
    return {
      ok: false,
      message: "Не заполнены обязательные поля LDAP: URL, учётная запись, пароль или Base DN",
      usersTotal: 0, usersUpdated: 0, usersCreated: 0, usersDeactivated: 0,
    };
  }

  const config: LdapConfig = {
    url: adConfig.ssoUrl,
    bindDn: adConfig.bindDn!,
    bindPassword: adConfig.bindPassword!,
    baseDn: adConfig.baseDn!,
    mappingDisplayName: adConfig.mappingDisplayName || "displayName",
    mappingEmail: adConfig.mappingEmail || "mail",
    mappingDepartment: adConfig.mappingDepartment || "department",
    mappingLegalEntity: adConfig.mappingLegalEntity || "company",
    mappingRoles: adConfig.mappingRoles,
  };

  await storage.upsertAdIntegrationConfig({
    ...adConfig,
    syncStatus: "in_progress",
  });

  try {
    const ldapUsers = await searchLdapUsers(config);

    const existingUsers = await storage.getUsers();
    const adUsers = existingUsers.filter(u => u.source === "ad");
    const adUsersByAccount = new Map(adUsers.map(u => [u.adAccountName?.toLowerCase(), u]));

    const now = new Date();
    let usersUpdated = 0;
    let usersCreated = 0;
    const foundAccounts = new Set<string>();

    for (const ldapUser of ldapUsers) {
      if (!ldapUser.sAMAccountName) continue;

      const accountKey = ldapUser.sAMAccountName.toLowerCase();
      foundAccounts.add(accountKey);

      const existing = adUsersByAccount.get(accountKey);

      if (existing) {
        await storage.updateUser(existing.id, {
          displayName: ldapUser.displayName || existing.displayName,
          email: ldapUser.email || existing.email,
          department: ldapUser.department || existing.department,
          legalEntity: ldapUser.legalEntity || existing.legalEntity,
          lastSyncAt: now,
          deactivatedAt: null,
          isAvailable: true,
        });
        usersUpdated++;
      } else {
        const username = ldapUser.sAMAccountName;
        const existingByUsername = existingUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existingByUsername) {
          await storage.updateUser(existingByUsername.id, {
            source: "ad",
            adAccountName: ldapUser.sAMAccountName,
            displayName: ldapUser.displayName || existingByUsername.displayName,
            email: ldapUser.email || existingByUsername.email,
            department: ldapUser.department || existingByUsername.department,
            legalEntity: ldapUser.legalEntity || existingByUsername.legalEntity,
            lastSyncAt: now,
            deactivatedAt: null,
            isAvailable: true,
          });
          usersUpdated++;
        } else {
          await storage.createUser({
            username: ldapUser.sAMAccountName,
            password: "",
            displayName: ldapUser.displayName || ldapUser.sAMAccountName,
            email: ldapUser.email || `${ldapUser.sAMAccountName}@unknown`,
            roles: ["Читатель"],
            legalEntity: ldapUser.legalEntity || "—",
            department: ldapUser.department || "—",
            isAvailable: true,
            source: "ad",
            adAccountName: ldapUser.sAMAccountName,
            lastSyncAt: now,
            deactivatedAt: null,
          });
          usersCreated++;
        }
      }
    }

    let usersDeactivated = 0;
    for (const adUser of adUsers) {
      const accountKey = adUser.adAccountName?.toLowerCase();
      if (accountKey && !foundAccounts.has(accountKey) && !adUser.deactivatedAt) {
        await storage.updateUser(adUser.id, {
          deactivatedAt: now,
          isAvailable: false,
        });
        usersDeactivated++;
      }
    }

    const totalSynced = usersUpdated + usersCreated;

    await storage.upsertAdIntegrationConfig({
      ...adConfig,
      syncStatus: "success",
      lastSyncAt: now,
      syncedUsersCount: totalSynced,
      deactivatedCount: usersDeactivated,
    });

    await storage.createAdSyncLog({
      syncedAt: now,
      status: "success",
      usersTotal: ldapUsers.length,
      usersUpdated,
      usersDeactivated,
      message: `Синхронизация завершена. Найдено: ${ldapUsers.length}, обновлено: ${usersUpdated}, создано: ${usersCreated}, деактивировано: ${usersDeactivated}`,
    });

    return {
      ok: true,
      message: `Синхронизация завершена. Найдено: ${ldapUsers.length}, обновлено: ${usersUpdated}, создано: ${usersCreated}, деактивировано: ${usersDeactivated}`,
      usersTotal: ldapUsers.length,
      usersUpdated,
      usersCreated,
      usersDeactivated,
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);

    await storage.upsertAdIntegrationConfig({
      ...adConfig,
      syncStatus: "error",
      lastSyncAt: new Date(),
    });

    await storage.createAdSyncLog({
      syncedAt: new Date(),
      status: "error",
      usersTotal: 0,
      usersUpdated: 0,
      usersDeactivated: 0,
      message: `Ошибка LDAP: ${errorMsg}`,
    });

    return {
      ok: false,
      message: `Ошибка подключения к LDAP: ${errorMsg}`,
      usersTotal: 0,
      usersUpdated: 0,
      usersCreated: 0,
      usersDeactivated: 0,
    };
  }
}

function searchLdapUsers(config: LdapConfig, accountName?: string): Promise<LdapUserEntry[]> {
  return new Promise((resolve, reject) => {
    const tlsOptions = config.url.startsWith("ldaps://") ? { rejectUnauthorized: false } : undefined;

    const client = ldap.createClient({
      url: config.url,
      tlsOptions,
      connectTimeout: 10000,
      timeout: 30000,
    });

    client.on("error", (err: any) => {
      reject(new Error(`Не удалось подключиться к LDAP-серверу: ${err.message}`));
    });

    client.on("connectError", (err: any) => {
      reject(new Error(`Не удалось подключиться к LDAP-серверу: ${err.message}`));
    });

    client.bind(config.bindDn, config.bindPassword, (bindErr: any) => {
      if (bindErr) {
        client.destroy();
        reject(new Error(`Ошибка аутентификации LDAP (bind): ${bindErr.message}`));
        return;
      }

      const baseFilter = accountName
        ? `(&(objectClass=user)(objectCategory=person)(sAMAccountName=${accountName.replace(/[*()\\\0]/g, "\\$&")}))`
        : "(&(objectClass=user)(objectCategory=person))";

      const searchOpts: ldap.SearchOptions = {
        filter: baseFilter,
        scope: "sub",
        attributes: [
          "sAMAccountName", "uid", "cn",
          "displayName", "mail", "userPrincipalName",
          "department", "company", "o",
          config.mappingDisplayName,
          config.mappingEmail,
          config.mappingDepartment,
          config.mappingLegalEntity,
        ].filter(Boolean),
        paged: true,
      };

      const users: LdapUserEntry[] = [];

      client.search(config.baseDn, searchOpts, (searchErr: any, searchRes: any) => {
        if (searchErr) {
          client.unbind(() => {});
          reject(new Error(`Ошибка поиска LDAP: ${searchErr.message}`));
          return;
        }

        searchRes.on("searchEntry", (entry: any) => {
          const parsed = parseLdapEntry(entry, config);
          if (parsed.sAMAccountName) {
            users.push(parsed);
          }
        });

        searchRes.on("error", (err: any) => {
          client.unbind(() => {});
          reject(new Error(`Ошибка при получении результатов LDAP: ${err.message}`));
        });

        searchRes.on("end", (_result: any) => {
          client.unbind(() => {});
          resolve(users);
        });
      });
    });
  });
}

export async function syncSingleLdapUser(accountName: string): Promise<{
  ok: boolean;
  message: string;
  action?: "updated" | "created" | "not_found";
  user?: Record<string, string>;
}> {
  const adConfig = await storage.getAdIntegrationConfig();
  if (!adConfig) return { ok: false, message: "Конфигурация AD не найдена" };
  if (!adConfig.enabled) return { ok: false, message: "Интеграция AD/SSO выключена" };
  if (adConfig.mode !== "LDAP") return { ok: false, message: "Режим интеграции не LDAP — функция доступна только в режиме LDAP" };
  if (!adConfig.ssoUrl || !adConfig.bindDn || !adConfig.bindPassword || !adConfig.baseDn) {
    return { ok: false, message: "Не заполнены обязательные поля LDAP: URL, учётная запись, пароль или Base DN" };
  }

  const config: LdapConfig = {
    url: adConfig.ssoUrl,
    bindDn: adConfig.bindDn!,
    bindPassword: adConfig.bindPassword!,
    baseDn: adConfig.baseDn!,
    mappingDisplayName: adConfig.mappingDisplayName || "displayName",
    mappingEmail: adConfig.mappingEmail || "mail",
    mappingDepartment: adConfig.mappingDepartment || "department",
    mappingLegalEntity: adConfig.mappingLegalEntity || "company",
    mappingRoles: adConfig.mappingRoles,
  };

  try {
    const ldapUsers = await searchLdapUsers(config, accountName.trim());

    if (ldapUsers.length === 0) {
      return { ok: false, message: `Аккаунт «${accountName}» не найден в LDAP`, action: "not_found" };
    }

    const ldapUser = ldapUsers[0];
    const now = new Date();
    const existingUsers = await storage.getUsers();

    const byAccount = existingUsers.find(u => u.adAccountName?.toLowerCase() === ldapUser.sAMAccountName.toLowerCase());
    const byUsername = existingUsers.find(u => u.username.toLowerCase() === ldapUser.sAMAccountName.toLowerCase());
    const target = byAccount || byUsername;

    if (target) {
      await storage.updateUser(target.id, {
        source: "ad",
        adAccountName: ldapUser.sAMAccountName,
        displayName: ldapUser.displayName || target.displayName,
        email: ldapUser.email || target.email,
        department: ldapUser.department || target.department,
        legalEntity: ldapUser.legalEntity || target.legalEntity,
        lastSyncAt: now,
        deactivatedAt: null,
        isAvailable: true,
      });
      await storage.createAdSyncLog({
        syncedAt: now, status: "success",
        usersTotal: 1, usersUpdated: 1, usersDeactivated: 0,
        message: `Точечная синхронизация: обновлён аккаунт ${ldapUser.sAMAccountName}`,
      });
      return {
        ok: true,
        message: `Аккаунт «${ldapUser.sAMAccountName}» успешно обновлён`,
        action: "updated",
        user: {
          displayName: ldapUser.displayName,
          email: ldapUser.email,
          department: ldapUser.department,
          legalEntity: ldapUser.legalEntity,
        },
      };
    } else {
      await storage.createUser({
        username: ldapUser.sAMAccountName,
        password: "",
        displayName: ldapUser.displayName || ldapUser.sAMAccountName,
        email: ldapUser.email || `${ldapUser.sAMAccountName}@unknown`,
        roles: ["Читатель"],
        legalEntity: ldapUser.legalEntity || "—",
        department: ldapUser.department || "—",
        isAvailable: true,
        source: "ad",
        adAccountName: ldapUser.sAMAccountName,
        lastSyncAt: now,
        deactivatedAt: null,
      });
      await storage.createAdSyncLog({
        syncedAt: now, status: "success",
        usersTotal: 1, usersUpdated: 0, usersDeactivated: 0,
        message: `Точечная синхронизация: создан аккаунт ${ldapUser.sAMAccountName}`,
      });
      return {
        ok: true,
        message: `Аккаунт «${ldapUser.sAMAccountName}» создан в системе`,
        action: "created",
        user: {
          displayName: ldapUser.displayName,
          email: ldapUser.email,
          department: ldapUser.department,
          legalEntity: ldapUser.legalEntity,
        },
      };
    }
  } catch (err: any) {
    return { ok: false, message: `Ошибка LDAP: ${err.message || String(err)}` };
  }
}

export function authenticateViaLdap(
  ldapUrl: string,
  baseDn: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const tlsOptions = ldapUrl.startsWith("ldaps://") ? { rejectUnauthorized: false } : undefined;

    const client = ldap.createClient({
      url: ldapUrl,
      tlsOptions,
      connectTimeout: 10000,
      timeout: 15000,
    });

    let resolved = false;
    function done(result: { ok: boolean; message: string }) {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }

    client.on("error", (err: any) => {
      done({ ok: false, message: `Не удалось подключиться к LDAP: ${err.message}` });
    });

    client.on("connectError", (err: any) => {
      done({ ok: false, message: `Не удалось подключиться к LDAP: ${err.message}` });
    });

    const bindDn = username.includes("@") || username.includes("\\")
      ? username
      : `${username}@${extractDomain(baseDn)}`;

    client.bind(bindDn, password, (err: any) => {
      client.destroy();
      if (err) {
        if (err.code === 49 || err.name === "InvalidCredentialsError") {
          done({ ok: false, message: "Неверный пароль или учётная запись" });
        } else {
          done({ ok: false, message: `Ошибка аутентификации LDAP: ${err.message}` });
        }
      } else {
        done({ ok: true, message: "OK" });
      }
    });

    setTimeout(() => {
      done({ ok: false, message: "Превышено время ожидания подключения к LDAP" });
      try { client.destroy(); } catch {}
    }, 12000);
  });
}

function extractDomain(baseDn: string): string {
  const parts = baseDn
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.toLowerCase().startsWith("dc="))
    .map((p) => p.substring(3));
  return parts.join(".") || baseDn;
}
