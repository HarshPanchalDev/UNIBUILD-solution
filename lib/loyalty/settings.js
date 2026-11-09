// Owner-editable settings (spec 7 — "all rates, multipliers, thresholds and periods are settings").
// Stored as versions: a change never alters points already credited.
import { CATEGORY_IDS, TRADES, TIERS, SHORTFALL_POLICIES } from "./constants.js";
import { invalid } from "./errors.js";

export const DEFAULT_SETTINGS = Object.freeze({
  // basis QUANTITY: points per `per` units (bags); VALUE: points per `per` rupees of taxable value
  rates: {
    1: { basis: "QUANTITY", points: 1, per: 1 },
    2: { basis: "VALUE", points: 1, per: 100 },
    3: { basis: "VALUE", points: 1, per: 100 },
    4: { basis: "VALUE", points: 1, per: 100 },
    5: { basis: "VALUE", points: 1, per: 100 },
  },
  multipliers: { SAATHI: 1, SILVER: 1.25, GOLD: 1.5 }, // [Proposed] Q7
  // Quarterly paid purchase value (₹) per trade to qualify. null = not decided yet (Q7) -> tiers are not recalculated.
  tierThresholds: {
    CONTRACTOR: { SILVER: null, GOLD: null },
    PLUMBER: { SILVER: null, GOLD: null },
    ELECTRICIAN: { SILVER: null, GOLD: null },
    PAINTER: { SILVER: null, GOLD: null },
  },
  lockDays: 30,
  expiryMonths: 12, // [Proposed] Q6
  minRedeem: 500, // [Proposed] Q6
  pointValue: 1, // ₹ per point [Proposed] Q6
  linkMonths: 12,
  linkReminderDays: 30,
  shortfallPolicy: "CAP_AND_FLAG", // Q3 open — Owner decides
});

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const maxDecimals = (v, n) => Math.round(v * 10 ** n) === v * 10 ** n || Math.abs(Math.round(v * 10 ** n) - v * 10 ** n) < 1e-6;

/** Deep-merge partial values onto defaults so older versions missing a key still work. */
export function normalizeSettings(values = {}) {
  const v = values || {};
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const id of CATEGORY_IDS) if (v.rates?.[id]) out.rates[id] = { ...out.rates[id], ...v.rates[id] };
  for (const t of TIERS) if (v.multipliers?.[t] !== undefined) out.multipliers[t] = Number(v.multipliers[t]);
  for (const tr of TRADES) {
    for (const t of ["SILVER", "GOLD"]) {
      const val = v.tierThresholds?.[tr]?.[t];
      if (val !== undefined) out.tierThresholds[tr][t] = val === null || val === "" ? null : Number(val);
    }
  }
  for (const k of ["lockDays", "expiryMonths", "minRedeem", "pointValue", "linkMonths", "linkReminderDays"]) {
    if (v[k] !== undefined && v[k] !== null && v[k] !== "") out[k] = Number(v[k]);
  }
  if (v.shortfallPolicy) out.shortfallPolicy = v.shortfallPolicy;
  return out;
}

/** Validate a full settings object. Throws AppError with field messages. */
export function validateSettings(input) {
  const s = normalizeSettings(input);
  const errors = {};
  for (const id of CATEGORY_IDS) {
    const r = s.rates[id];
    if (!["QUANTITY", "VALUE"].includes(r.basis)) errors[`rates.${id}.basis`] = "Basis must be QUANTITY or VALUE";
    if (!isNum(r.points) || r.points < 0 || !maxDecimals(r.points, 4)) errors[`rates.${id}.points`] = "Points must be 0 or more (max 4 decimals)";
    if (!isNum(r.per) || r.per <= 0 || !maxDecimals(r.per, 4)) errors[`rates.${id}.per`] = "Must be more than 0";
  }
  for (const t of TIERS) {
    const m = s.multipliers[t];
    if (!isNum(m) || m <= 0 || m > 10 || !maxDecimals(m, 4)) errors[`multipliers.${t}`] = "Multiplier must be between 0 and 10";
  }
  for (const tr of TRADES) {
    const { SILVER, GOLD } = s.tierThresholds[tr];
    for (const [k, val] of Object.entries({ SILVER, GOLD })) {
      if (val !== null && (!isNum(val) || val < 0)) errors[`tierThresholds.${tr}.${k}`] = "Threshold must be a positive amount or empty";
    }
    if (isNum(SILVER) && isNum(GOLD) && GOLD <= SILVER) errors[`tierThresholds.${tr}.GOLD`] = "Gold threshold must be higher than Silver";
  }
  const ints = { lockDays: [0, 365], expiryMonths: [1, 120], minRedeem: [1, 1000000], linkMonths: [1, 60], linkReminderDays: [1, 180] };
  for (const [k, [min, max]] of Object.entries(ints)) {
    if (!Number.isInteger(s[k]) || s[k] < min || s[k] > max) errors[k] = `Must be a whole number from ${min} to ${max}`;
  }
  if (!isNum(s.pointValue) || s.pointValue <= 0 || !maxDecimals(s.pointValue, 4)) errors.pointValue = "Must be more than 0";
  if (!SHORTFALL_POLICIES[s.shortfallPolicy]) errors.shortfallPolicy = "Unknown policy";
  if (Object.keys(errors).length) throw invalid("Some settings are not valid", errors);
  return s;
}
