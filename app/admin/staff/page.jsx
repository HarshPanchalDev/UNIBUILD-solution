import { Card, PageHeader, Table, td, Badge } from "@/components/ui";
import StaffForm from "@/components/admin/StaffForm";
import { prisma } from "@/lib/server/db";
import { requireStaffPage } from "@/lib/server/auth";
import { fmtDateTime } from "@/lib/server/format";

export const metadata = { title: "Staff · UNIBUILD Admin" };

export default async function StaffPage() {
  await requireStaffPage("staff.manage");
  const staff = await prisma.user.findMany({ where: { role: { in: ["STORE_MANAGER", "OWNER"] } }, orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Staff accounts" subtitle="Owner only. Counter staff use BUSY only and need no account here." action={<StaffForm />} />
      <Card className="overflow-hidden">
        <Table head={["Name", "Email", "Mobile", "Role", "Last sign-in", "Status", ""]} minWidth={760}>
          {staff.map((u) => (
            <tr key={u.id}>
              <td className={`${td} font-medium text-navy-900`}>{u.name}</td>
              <td className={`${td} text-slate-600`}>{u.email}</td>
              <td className={`${td} text-slate-600`}>{u.mobile ?? "—"}</td>
              <td className={td}><Badge tone={u.role === "OWNER" ? "GOLD" : "SAATHI"}>{u.role === "OWNER" ? "Owner" : "Store Manager"}</Badge></td>
              <td className={`${td} text-slate-600`}>{fmtDateTime(u.lastLoginAt)}</td>
              <td className={td}><Badge tone={u.isActive ? "ACTIVE" : "INACTIVE"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
              <td className={td}><StaffForm user={{ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, isActive: u.isActive }} /></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
