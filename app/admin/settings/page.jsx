import { Card, PageHeader } from "@/components/ui";
import SettingsForm, { RunJobsButton } from "@/components/admin/SettingsForm";
import { prisma, repo } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { fmtDateTime } from "@/lib/server/format";

export const metadata = { title: "Settings · UNIBUILD Admin" };

export default async function SettingsPage() {
  await requireStaffPage("settings.manage");
  const current = await getActiveSettings(repo);
  const versions = await prisma.settingsVersion.findMany({ orderBy: { id: "desc" }, take: 15 });
  const users = new Map((await prisma.user.findMany({ where: { id: { in: versions.map((v) => v.createdById).filter(Boolean) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={`Owner only. Every save creates a new version (now #${current.id}). Points already credited are never recalculated; each upload keeps the version it used.`}
        action={<RunJobsButton />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <SettingsForm values={current.values} />
        <Card className="h-fit p-5">
          <p className="mb-3 font-semibold text-navy-900">Version history</p>
          <ul className="space-y-3 text-sm">
            {versions.map((v) => (
              <li key={v.id}>
                <p className="font-medium text-navy-900">#{v.id} {v.id === current.id && <span className="ml-1 rounded bg-emerald-50 px-1.5 text-xs text-emerald-700">current</span>}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(v.createdAt)} · {users.get(v.createdById) ?? "System"}</p>
                {v.note && <p className="text-xs text-slate-600">{v.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
