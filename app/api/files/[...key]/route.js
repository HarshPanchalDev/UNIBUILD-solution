import { getSession } from "@/lib/server/auth";
import { readStored, contentTypeFor } from "@/lib/server/storage";
import { isStaffRole } from "@/lib/server/permissions";

// Access rules: rewards/* public; partners/{id}/* staff or that partner; busy/* staff only.
export async function GET(_req, ctx) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (key.includes("..")) return new Response("Not found", { status: 404 });
  const [area, owner] = parts;
  if (area !== "rewards") {
    const s = await getSession();
    const staff = s && isStaffRole(s.user.role);
    const self = s && area === "partners" && s.partner && String(s.partner.id) === owner;
    if (!(staff || self) || (area === "busy" && !staff)) return new Response("Not found", { status: 404 });
  }
  try {
    const data = await readStored(key);
    return new Response(data, {
      headers: {
        "content-type": contentTypeFor(key),
        "cache-control": area === "rewards" ? "public, max-age=86400" : "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
