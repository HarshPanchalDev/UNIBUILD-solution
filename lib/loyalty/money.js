// Exact decimal handling with BigInt. Money and quantities never pass through floats
// in calculations, so ₹12,450 → 124 points exactly (spec T-01).

/**
 * Parse a decimal value into a scaled BigInt (e.g. scale 2: "38,000.50" -> 3800050n).
 * Accepts numbers, numeric strings with commas, spaces, ₹ / Rs prefixes, and parentheses for negatives.
 * Returns null when the value is empty or not a valid number.
 */
export function parseScaled(input, scale) {
  if (input === null || input === undefined) return null;
  let s;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    s = input.toFixed(Math.max(scale, 6));
  } else if (typeof input === "bigint") {
    return input * 10n ** BigInt(scale);
  } else {
    s = String(input).trim();
  }
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/₹|rs\.?|inr/gi, "").replace(/[,\s]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const [intPart, fracPart = ""] = s.split(".");
  const frac = (fracPart + "0".repeat(scale)).slice(0, scale);
  // round half up on the first dropped digit
  const dropped = fracPart.length > scale ? Number(fracPart[scale]) : 0;
  let value = BigInt((intPart || "0") + frac);
  if (dropped >= 5) value += 1n;
  return negative ? -value : value;
}

/** Format a scaled BigInt as a plain decimal string ("12450.00"). */
export function formatScaled(value, scale) {
  const v = BigInt(value);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const str = abs.toString().padStart(scale + 1, "0");
  const out = scale === 0 ? str : `${str.slice(0, -scale)}.${str.slice(-scale)}`;
  return neg ? `-${out}` : out;
}

/** Convert a decimal string/number to a scaled BigInt, throwing on invalid input (for trusted values). */
export function toScaled(value, scale) {
  const r = parseScaled(value, scale);
  if (r === null) throw new Error(`Invalid decimal: ${value}`);
  return r;
}

export const VALUE_SCALE = 2; // paise
export const QTY_SCALE = 3; // 0.001 of a unit
export const FACTOR_SCALE = 4; // rates and multipliers

/**
 * Points for a basis amount:  floor( basis × (ratePoints / ratePer) × multiplier )
 * basisScaled is a BigInt at basisScale; rate and multiplier are decimals (string/number).
 * Always rounds down (spec 7.3).
 */
export function calcPoints({ basisScaled, basisScale, ratePoints, ratePer, multiplier }) {
  const B = BigInt(basisScaled);
  if (B <= 0n) return 0;
  const P = toScaled(ratePoints, FACTOR_SCALE);
  const R = toScaled(ratePer, FACTOR_SCALE);
  const M = toScaled(multiplier, FACTOR_SCALE);
  if (R <= 0n || P < 0n || M < 0n) return 0;
  const numerator = B * P * M;
  const denominator = 10n ** BigInt(basisScale) * R * 10n ** BigInt(FACTOR_SCALE);
  return Number(numerator / denominator);
}

export function formatRupees(scaledPaise) {
  const n = Number(BigInt(scaledPaise)) / 100;
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}
