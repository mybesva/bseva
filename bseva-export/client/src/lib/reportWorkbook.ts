import * as XLSX from "xlsx";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  buildReportSheetTables,
  reportWorkbookFilename,
  type ReportWorkbookData,
} from "@bseva/config";

export type { ReportWorkbookData };

export function downloadReportWorkbook(report: ReportWorkbookData) {
  const wb = XLSX.utils.book_new();
  for (const table of buildReportSheetTables(report, formatDisplayDate)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table.rows), table.name);
  }
  XLSX.writeFile(wb, reportWorkbookFilename(report));
}
