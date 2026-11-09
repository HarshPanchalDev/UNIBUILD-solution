import { Award, Gift } from "lucide-react";
import { Card, PageHeader, StatusBadge, EmptyState, formatPts } from "@/components/ui";
import RewardForm from "@/components/admin/RewardForm";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fileUrl } from "@/lib/server/storage";

export const metadata = { title: "Rewards · UNIBUILD Admin" };

export default async function RewardsAdmin() {
  await requireStaffPage("rewards.manage");
  const rewards = await prisma.reward.findMany({ orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { points: "asc" }], include: { _count: { select: { redemptions: true } } } });
  return (
    <>
      <PageHeader title="Rewards catalogue" subtitle="Owner only. The first catalogue (items and points) is an open decision (Q12) — add the real items here." action={<RewardForm />} />
      {rewards.length === 0 ? (
        <Card><EmptyState icon={Award} title="No rewards yet" text="Partners see this catalogue in the app. Add rewards with their points cost and a photo." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <Card key={r.id} className={`flex flex-col p-4 ${r.status !== "ACTIVE" ? "opacity-70" : ""}`}>
              <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                {r.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(r.imageKey)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Gift className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-navy-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.section} · {r._count.redemptions} redemption{r._count.redemptions === 1 ? "" : "s"}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.description && <p className="mt-1 text-sm text-slate-600">{r.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="font-display text-lg font-bold text-navy-900">{formatPts(r.points)} pts</span>
                <RewardForm reward={{ id: r.id, name: r.name, description: r.description ?? "", section: r.section, points: r.points, status: r.status, sortOrder: r.sortOrder, imageUrl: fileUrl(r.imageKey) }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
