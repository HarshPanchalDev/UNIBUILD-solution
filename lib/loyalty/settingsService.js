import { DEFAULT_SETTINGS, normalizeSettings, validateSettings } from "./settings.js";
import { audit } from "./notify.js";

/** Latest settings version; creates the default version on first use. */
export async function getActiveSettings(repo) {
  let version = await repo.getLatestSettingsVersion();
  if (!version) {
    version = await repo.createSettingsVersion({ values: structuredClone(DEFAULT_SETTINGS), note: "Default settings", createdById: null });
  }
  return { id: version.id, values: normalizeSettings(version.values), createdAt: version.createdAt };
}

export async function getSettingsById(repo, id) {
  if (!id) return getActiveSettings(repo);
  const v = await repo.getSettingsVersion(id);
  if (!v) return getActiveSettings(repo);
  return { id: v.id, values: normalizeSettings(v.values), createdAt: v.createdAt };
}

/** Owner only. Creates a new version; uploads made earlier keep their own version (spec 7, T-14). */
export async function updateSettings(repo, { values, note = null, userId, ip = null }) {
  const current = await getActiveSettings(repo);
  const next = validateSettings(values);
  return repo.transaction(async (tx) => {
    const version = await tx.createSettingsVersion({ values: next, note, createdById: userId });
    await audit(tx, { userId, action: "SETTINGS_UPDATE", entityType: "Settings", entityId: version.id, before: current.values, after: next, reason: note, ip });
    return { id: version.id, values: next };
  });
}
