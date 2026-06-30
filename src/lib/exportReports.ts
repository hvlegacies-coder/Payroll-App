import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportSection {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

const escapeCsv = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSectionsCsv(sections: ExportSection[], filename: string) {
  const lines: string[] = [];
  sections.forEach((s, i) => {
    if (i > 0) lines.push('');
    lines.push(escapeCsv(s.title));
    lines.push(s.columns.map(escapeCsv).join(','));
    s.rows.forEach((r) => lines.push(r.map(escapeCsv).join(',')));
  });
  download(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportSectionsPdf(sections: ExportSection[], filename: string, heading?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Brand palette
  const brand: [number, number, number] = [37, 99, 235];        // blue-600
  const brandDark: [number, number, number] = [30, 58, 138];    // blue-900
  const accent: [number, number, number] = [16, 185, 129];      // emerald-500
  const sectionBg: [number, number, number] = [241, 245, 249];  // slate-100
  const altRow: [number, number, number] = [248, 250, 252];     // slate-50
  const textDark: [number, number, number] = [15, 23, 42];      // slate-900
  const textMuted: [number, number, number] = [100, 116, 139];  // slate-500

  // Cover header band
  doc.setFillColor(...brandDark);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 70, pageWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(heading || 'Report', 40, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(219, 234, 254);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 56);

  let startY = 96;

  sections.forEach((s, idx) => {
    // Section title band
    autoTable(doc, {
      head: [[s.title]],
      body: [],
      startY,
      theme: 'plain',
      margin: { left: 40, right: 40 },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 12,
        textColor: brandDark,
        fillColor: sectionBg,
        cellPadding: { top: 6, bottom: 6, left: 10, right: 10 },
        lineWidth: { bottom: 1.2 } as any,
        lineColor: brand,
      },
    });

    autoTable(doc, {
      head: [s.columns],
      body: s.rows.map((r) => r.map((c) => String(c ?? ''))),
      startY: (doc as any).lastAutoTable.finalY + 4,
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: textDark,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: brand,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      alternateRowStyles: { fillColor: altRow },
      margin: { left: 40, right: 40 },
      theme: 'grid',
    });

    startY = (doc as any).lastAutoTable.finalY + 18;

    if (startY > pageHeight - 60 && idx < sections.length - 1) {
      doc.addPage();
      startY = 40;
    }
  });

  // Footer with page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.5);
    doc.line(40, pageHeight - 28, pageWidth - 40, pageHeight - 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(heading || 'Report', 40, pageHeight - 14);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, pageHeight - 14, { align: 'right' });
  }

  doc.save(filename);
}