import { requireApiUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/api";
import { buildWorkbook, xlsxResponse } from "@/lib/server/spreadsheet";
import { INVOICE_COLUMNS, CREDIT_NOTE_COLUMNS, SITE_IMPORT_COLUMNS } from "@/lib/busy/columns";

// Downloadable sample files so staff (and the BUSY dealer) can see the exact expected columns.
const SAMPLES = {
  "paid-invoices": {
    columns: INVOICE_COLUMNS,
    rows: [
      ["UB/26-27/1045", "14-11-2026", "19-11-2026", "SAL-0012", "PPC Cement 50 kg", 1, 100, "Bag", 38000],
      ["UB/26-27/1045", "14-11-2026", "19-11-2026", "SAL-0012", "CPVC Pipe 1 inch", 3, 30, "Pcs", 12450],
      ["UB/26-27/1046", "15-11-2026", "19-11-2026", "WALK-IN", "Wall Putty 20 kg", 5, 2, "Bag", 1400],
    ],
  },
  "credit-notes": {
    columns: CREDIT_NOTE_COLUMNS,
    rows: [["CN/26-27/0045", "21-11-2026", "UB/26-27/1045", "SAL-0012", "PPC Cement 50 kg", 1, 10, "Bag", 3800]],
  },
  "sites-import": {
    columns: SITE_IMPORT_COLUMNS,
    rows: [["SAL-0001", "Mohan Sharma", "9826012345, 9826054321", "Salaiya", "Plot 12, Near Water Tank", "https://maps.app.goo.gl/example"]],
  },
};

export async function GET(_req, ctx) {
  try {
    await requireApiUser({ role: "STAFF" });
    const { name } = await ctx.params;
    const sample = SAMPLES[name];
    if (!sample) return new Response("Not found", { status: 404 });
    const keys = sample.columns.map((c) => c.key);
    const buffer = await buildWorkbook([
      {
        sheetName: "Sample",
        columns: sample.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, c.label.length + 4) })),
        rows: sample.rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]))),
      },
    ]);
    return xlsxResponse(buffer, `unibuild-sample-${name}.xlsx`);
  } catch (e) {
    return errorResponse(e);
  }
}
