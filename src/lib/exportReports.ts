import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportData {
  title: string;
  metrics: { label: string; value: string | number }[];
  tableData?: { headers: string[]; rows: (string | number)[][] };
}

export function exportToPDF(report: ReportData) {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(20);
  doc.setTextColor(33, 55, 100);
  doc.text(report.title, 14, 22);
  
  // Date
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 30);
  
  // Metrics summary
  doc.setFontSize(14);
  doc.setTextColor(33, 55, 100);
  doc.text('Summary', 14, 44);
  
  let yPos = 52;
  doc.setFontSize(10);
  report.metrics.forEach((m) => {
    doc.setTextColor(80, 80, 80);
    doc.text(`${m.label}:`, 14, yPos);
    doc.setTextColor(33, 33, 33);
    doc.text(String(m.value), 80, yPos);
    yPos += 8;
  });

  // Table
  if (report.tableData) {
    autoTable(doc, {
      startY: yPos + 10,
      head: [report.tableData.headers],
      body: report.tableData.rows,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [33, 55, 100], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
  }

  doc.save(`${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportToExcel(report: ReportData) {
  const wb = XLSX.utils.book_new();

  // Metrics sheet
  const metricsData = report.metrics.map((m) => ({ Metric: m.label, Value: m.value }));
  const ws1 = XLSX.utils.json_to_sheet(metricsData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Table sheet
  if (report.tableData) {
    const tableRows = report.tableData.rows.map((row) => {
      const obj: Record<string, string | number> = {};
      report.tableData!.headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
    const ws2 = XLSX.utils.json_to_sheet(tableRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Data');
  }

  XLSX.writeFile(wb, `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
