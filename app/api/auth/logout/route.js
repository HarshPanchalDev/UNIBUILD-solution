import { api } from "@/lib/server/api";
import { destroySession, getSession } from "@/lib/server/auth";

export const POST = api(async () => {
  const s = await getSession();
  await destroySession();
  return { ok: true, redirect: s && s.user.role !== "PARTNER" ? "/staff/login" : "/login" };
});
