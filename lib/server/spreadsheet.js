import "server-only";
import ExcelJS from "exceljs";
import { parseCsv } from "../busy/csv.js";
import { invalid } from "../loyalty/errors.js";

export const SPREADSHEET_MAX_BYTES = 10 * 1024 * 1024;

const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b; // .xlsx is a zip file

function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result); // formula
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return v.text; // hyperlink
    if ("error" in v) return "";
  }
  return v;
}

/** Read an uploaded .xlsx or .csv into rows of cells. Validates type and size. */
export async function readSpreadsheet(file) {
  if (!file || typeof file.arrayBuffer !== "function") throw invalid("Choose a file to upload");
  if (file.size === 0) throw invalid("The file is empty");
  if (file.size > SPREADSHEET_MAX_BYTES) throw invalid("File must be 10 MB or smaller");
  const name = String(file.name || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".xlsx")) {
    if (!isZip(buffer)) throw invalid("This is not a valid .xlsx file");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw invalid("The workbook has no sheets");
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      for (let c = 1; c <= ws.columnCount; c++) values.push(cellValue(row.getCell(c).value));
      rows.push(values);
    });
    return { rows, buffer, ext: "xlsx" };
  }
  if (name.endsWith(".csv")) {
    if (isZip(buffer) || buffer.includes(0)) throw invalid("This is not a valid CSV text file");
    return { rows: parseCsv(buffer.toString("utf8")), buffer, ext: "csv" };
  }
  throw invalid("Only .xlsx and .csv files are accepted (old .xls is not supported — save as .xlsx)");
}

/** Build an .xlsx from { sheetName, columns: [{header,key,width}], rows } */
export async function buildWorkbook(sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "UNIBUILD Partner App";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.sheetName.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF3FA" } };
    for (const r of s.rows) ws.addRow(r);
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buffer, fileName) {
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName.replace(/[^a-z0-9._-]/gi, "_")}"`,
      "cache-control": "no-store",
    },
  });
}
