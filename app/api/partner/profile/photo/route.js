import { api } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireApiUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rateLimit";
import { saveImage, fileUrl } from "@/lib/server/storage";

export const POST = api(async (req) => {
  const s = await requireApiUser({ role: "PARTNER" });
  await rateLimit(`photo:${s.partner.id}`, 10, 3600);
  const form = await req.formData();
  const key = await saveImage(form.get("photo"), `partners/${s.partner.id}`);
  await prisma.partner.update({ where: { id: s.partner.id }, data: { photoKey: key } });
  return { ok: true, url: fileUrl(key) };
});
