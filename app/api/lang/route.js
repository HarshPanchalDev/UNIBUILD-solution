import { cookies } from "next/headers";
import { z } from "zod";
import { api, readJson } from "@/lib/server/api";
import { LANG_COOKIE } from "@/lib/i18n";

const schema = z.object({ lang: z.enum(["hi", "en"]) });

export const POST = api(async (req) => {
  const { lang } = await readJson(req, schema);
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return { ok: true };
});
