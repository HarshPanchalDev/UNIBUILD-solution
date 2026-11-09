import { redirect } from "next/navigation";
import { I18nProvider } from "@/components/client/I18n";
import { getLang } from "@/lib/i18n/server";
import { getSession } from "@/lib/server/auth";

export const metadata = { title: "Sign in · UNIBUILD Partner App" };
export const dynamic = "force-dynamic";

export default async function LoginLayout({ children }) {
  const s = await getSession().catch(() => null);
  if (s?.user.role === "PARTNER") redirect("/partner");
  return <I18nProvider lang={await getLang()}>{children}</I18nProvider>;
}
