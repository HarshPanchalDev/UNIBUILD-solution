// Point lot states are derived from dates, not stored, so a missed cron run can never
// leave points wrongly redeemable or locked (spec 7.5).

export function lotState(lot, now = new Date()) {
  if (lot.remaining > 0) {
    if (now >= new Date(lot.expiresAt)) return "EXPIRED";
    if (now < new Date(lot.unlockAt)) return "LOCKED";
    return "AVAILABLE";
  }
  const used = [
    ["REDEEMED", lot.redeemedPoints || 0],
    ["REVERSED", lot.reversedPoints || 0],
    ["EXPIRED", lot.expiredPoints || 0],
  ].sort((a, b) => b[1] - a[1]);
  return used[0][1] > 0 ? used[0][0] : "REVERSED";
}

export function isSpendable(lot, now = new Date()) {
  return lot.remaining > 0 && now >= new Date(lot.unlockAt) && now < new Date(lot.expiresAt);
}

/** Oldest first: earliest expiry, then earliest credit. */
export function sortOldestFirst(lots) {
  return [...lots].sort(
    (a, b) =>
      new Date(a.expiresAt) - new Date(b.expiresAt) ||
      new Date(a.creditedAt) - new Date(b.creditedAt) ||
      a.id - b.id
  );
}

export function summarizeLots(lots, now = new Date()) {
  let available = 0;
  let locked = 0;
  let nextUnlock = null;
  let expiringSoon = 0;
  const soon = new Date(now.getTime() + 30 * 86400000);
  for (const lot of lots) {
    const state = lotState(lot, now);
    if (state === "AVAILABLE") {
      available += lot.remaining;
      if (new Date(lot.expiresAt) <= soon) expiringSoon += lot.remaining;
    } else if (state === "LOCKED") {
      locked += lot.remaining;
      const at = new Date(lot.unlockAt);
      if (!nextUnlock || at < nextUnlock.at) nextUnlock = { at, points: lot.remaining };
      else if (at.getTime() === nextUnlock.at.getTime()) nextUnlock.points += lot.remaining;
    }
  }
  return { available, locked, total: available + locked, nextUnlock, expiringSoon };
}
