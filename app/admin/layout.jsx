import AdminShell from "@/components/client/AdminShell";
import { requireStaffPage } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { can } from "@/lib/server/permissions";

export const metadata = { title: "Admin · UNIBUILD Partner App", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", perm: "dashboard.view" },
  { href: "/admin/uploads", label: "Uploads", icon: "Upload", perm: "uploads.manage" },
  { href: "/admin/exceptions", label: "Exceptions", icon: "AlertTriangle", perm: "exceptions.manage", badge: "exceptions" },
  { href: "/admin/sites", label: "Sites", icon: "MapPin", perm: "sites.manage" },
  { href: "/admin/partners", label: "Partners", icon: "Users", perm: "partners.manage", badge: "partners" },
  { href: "/admin/links", label: "Links", icon: "Link2", perm: "links.manage", badge: "linkRequests" },
  { href: "/admin/redemptions", label: "Redemptions", icon: "Gift", perm: "redemptions.manage", badge: "redemptions" },
  { href: "/admin/rewards", label: "Rewards", icon: "Award", perm: "rewards.manage" },
  { href: "/admin/reports", label: "Reports", icon: "BarChart3", perm: "reports.view" },
  { href: "/admin/settings", label: "Settings", icon: "Settings", perm: "settings.manage" },
  { href: "/admin/staff", label: "Staff", icon: "UserCog", perm: "staff.manage" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "ScrollText", perm: "audit.view" },
];

export default async function AdminLayout({ children }) {
  const s = await requireStaffPage();
  const staffWhere = { audience: "STAFF", OR: [{ userId: null }, { userId: s.user.id }] };
  const [notifications, unread, exceptions, partners, linkRequests, redemptions] = await Promise.all([
    prisma.notification.findMany({ where: staffWhere, orderBy: { id: "desc" }, take: 12 }),
    prisma.notification.count({ where: { ...staffWhere, readAt: null } }),
    prisma.uploadException.count({ where: { status: "OPEN" } }),
    prisma.partner.count({ where: { status: "PENDING" } }),
    prisma.siteLinkRequest.count({ where: { status: "PENDING" } }),
    prisma.redemption.count({ where: { status: "REQUESTED" } }),
  ]);
  const counts = { exceptions, partners, linkRequests, redemptions };
  const nav = NAV.filter((n) => can(s.user.role, n.perm)).map(({ perm, badge, ...n }) => ({ ...n, badge: badge ? counts[badge] : 0 }));
  return (
    <AdminShell
      nav={nav}
      user={s.user}
      unread={unread}
      notifications={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))}
    >
      {children}
    </AdminShell>
  );
}
