import { api } from "@/lib/server/api";
import { repo } from "@/lib/server/db";
import { requireApiUser, clientIp } from "@/lib/server/auth";
import { runReport } from "@/lib/server/reports";
import { buildWorkbook, xlsxResponse } from "@/lib/server/spreadsheet";
import { audit } from "@/lib/loyalty/notify";

// GET /api/admin/reports/{name}?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=xlsx]
export const GET = api(async (req, { report }) => {
  const s = await requireApiUser({ role: "STAFF", permission: "reports.view" });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const data = await runReport(report, params);
  if (params.format !== "xlsx") return data;
  const buffer = await buildWorkbook([
    {
      sheetName: data.title,
      columns: data.columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 4) })),
      rows: data.rows,
    },
  ]);
  await audit(repo, { userId: s.user.id, action: "REPORT_EXPORT", entityType: "Report", entityId: report, after: data.range, ip: await clientIp() });
  return xlsxResponse(buffer, `unibuild-${report}-${data.range.from}-to-${data.range.to}.xlsx`);
});
