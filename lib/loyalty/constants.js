// Business constants from the UNIBUILD spec (section 7). Rates/multipliers live in settings.

export const CATEGORIES = {
  1: { id: 1, name: "Cement", nameHi: "सीमेंट" },
  2: { id: 2, name: "Waterproofing and Hardware", nameHi: "वॉटरप्रूफिंग और हार्डवेयर" },
  3: { id: 3, name: "Plumbing", nameHi: "प्लंबिंग" },
  4: { id: 4, name: "Electrical", nameHi: "इलेक्ट्रिकल" },
  5: { id: 5, name: "Paint", nameHi: "पेंट" },
};

export const CATEGORY_IDS = [1, 2, 3, 4, 5];

// Spec 7.2 — who earns each category
export const CATEGORY_TRADE = {
  1: "CONTRACTOR",
  2: "CONTRACTOR",
  3: "PLUMBER",
  4: "ELECTRICIAN",
  5: "PAINTER",
};

export const TRADES = ["CONTRACTOR", "PLUMBER", "ELECTRICIAN", "PAINTER"];

export const TRADE_CODE = {
  CONTRACTOR: "CO",
  PLUMBER: "PL",
  ELECTRICIAN: "EL",
  PAINTER: "PA",
};

export const TRADE_LABEL = {
  CONTRACTOR: "Contractor",
  PLUMBER: "Plumber",
  ELECTRICIAN: "Electrician",
  PAINTER: "Painter",
};

export const TIERS = ["SAATHI", "SILVER", "GOLD"];
export const TIER_LABEL = { SAATHI: "Saathi", SILVER: "Silver", GOLD: "Gold" };

export const WALK_IN = "WALK-IN";

export const SHORTFALL_POLICIES = {
  CAP_AND_FLAG: "Deduct what the balance allows, record the rest as a shortfall for the Owner to decide",
  CARRY_FORWARD: "Deduct what the balance allows, recover the rest from the partner's next credited points",
};

export function categoryName(id, lang = "en") {
  const c = CATEGORIES[id];
  if (!c) return `Category ${id}`;
  return lang === "hi" ? c.nameHi : c.name;
}
