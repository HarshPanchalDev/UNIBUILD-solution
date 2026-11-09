import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, DEFAULT_LANG, LANGS, getDict, translate } from "./index.js";

export async function getLang() {
  const jar = await cookies();
  const v = jar.get(LANG_COOKIE)?.value;
  return LANGS.includes(v) ? v : DEFAULT_LANG;
}

export async function getT() {
  const lang = await getLang();
  const dict = getDict(lang);
  return { lang, dict, t: (key, vars) => translate(dict, key, vars) };
}
