// Partner-facing text in Hindi (default) and English. Admin panel is English.
import { hi } from "./hi.js";
import { en } from "./en.js";

export const LANG_COOKIE = "ub_lang";
export const LANGS = ["hi", "en"];
export const DEFAULT_LANG = "hi";

const DICTS = { hi, en };

export function getDict(lang) {
  return DICTS[lang] ?? DICTS[DEFAULT_LANG];
}

/** t(dict, "a.b", {name}) — falls back to English, then to the key. */
export function translate(dict, key, vars) {
  const pick = (d) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
  let s = pick(dict) ?? pick(en) ?? key;
  if (typeof s !== "string") return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
  return s;
}
