import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Capacitor } from "@capacitor/core";

/**
 * Helper: convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' && window.btoa ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Helper: write base64 to device file system on native (Android/iOS) using Capacitor Filesystem + Share
 */
async function writeBase64ToDevice(filename: string, base64Data: string, mimeType: string) {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Not running on native platform');
  }

  const { Filesystem, FilesystemDirectory } = await new Function('return import("@capacitor/filesystem")')();
  const { Share } = await new Function('return import("@capacitor/share")')();

  // Try multiple write locations for better compatibility across Android versions
  const attempts = [
    { path: filename, directory: FilesystemDirectory.External },
    { path: `Download/${filename}`, directory: FilesystemDirectory.External },
    { path: filename, directory: FilesystemDirectory.Documents }
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const result = await Filesystem.writeFile({
        path: attempt.path,
        data: base64Data,
        directory: attempt.directory,
        recursive: true
      });

      const fileUri = (result as any).uri || attempt.path;
      try {
        await Share.share({
          title: filename,
          url: fileUri
        });
      } catch (shareErr) {
        console.warn('Share failed, but file was written:', shareErr, fileUri);
      }

      return { success: true, uri: fileUri };
    } catch (err) {
      lastError = err;
      console.warn('Write attempt failed for', attempt, err);
    }
  }

  console.error('All write attempts failed:', lastError);
  throw lastError || new Error('Failed to write file to device');
}

export interface SalesReportData {
  date: string;
  client: string;
  service: string;
  staff: string;
  amount: number;
  paymentMethod: string;
}

export interface CommissionReportData {
  staff: string;
  totalSales: number;
  commissionRate: number;
  commissionAmount: number;
  period: string;
}

export const exportSalesToPDF = async (data: SalesReportData[], businessName: string, startDate?: string, endDate?: string) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`${businessName} - Sales Report`, 14, 20);
  
  // Add date range
  if (startDate && endDate) {
    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 28);
  }
  
  // Add generation date
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 34);
  
  // Calculate totals
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  
  // Add table
  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Client', 'Service', 'Staff', 'Amount', 'Payment']],
    body: data.map(item => [
      item.date,
      item.client,
      item.service,
      item.staff,
      `$${item.amount.toFixed(2)}`,
      item.paymentMethod
    ]),
    foot: [['', '', '', 'Total:', `$${totalAmount.toFixed(2)}`, '']],
    theme: 'grid',
    headStyles: { fillColor: [147, 135, 245] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });
  
  // Save the PDF (use blob download for better mobile compatibility)
  const filename = `sales-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  try {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.warn('Blob download failed, falling back to direct save', error);
    doc.save(filename);
  }
};

export const exportSalesToExcel = async (data: SalesReportData[], businessName: string, startDate?: string, endDate?: string) => {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Calculate totals
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  
  // Prepare data with headers
  const wsData = [
    [`${businessName} - Sales Report`],
    startDate && endDate ? [`Period: ${startDate} to ${endDate}`] : [],
    [`Generated: ${format(new Date(), "PPP")}`],
    [], // Empty row
    ['Date', 'Client', 'Service', 'Staff', 'Amount', 'Payment Method'],
    ...data.map(item => [
      item.date,
      item.client,
      item.service,
      item.staff,
      item.amount,
      item.paymentMethod
    ]),
    [], // Empty row
    ['', '', '', 'Total:', totalAmount, '']
  ].filter(row => row.length > 0);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Client
    { wch: 25 }, // Service
    { wch: 20 }, // Staff
    { wch: 10 }, // Amount
    { wch: 15 }  // Payment
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
  
  // Save file (use blob download for better mobile compatibility)
  const filename = `sales-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  try {
    const excelArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.warn('Blob download failed, falling back to direct save', error);
    XLSX.writeFile(wb, filename);
  }
};

export const exportSalesToCSV = async (data: SalesReportData[], businessName: string, startDate?: string, endDate?: string) => {
  try {
    // Create CSV content
    let csvContent = `${businessName} - Sales Report\n`;
    if (startDate && endDate) {
      csvContent += `Period: ${startDate} to ${endDate}\n`;
    }
    csvContent += `Generated: ${format(new Date(), "PPP")}\n\n`;
    
    // Header
    csvContent += `Date,Client,Service,Staff,Amount,Payment Method\n`;
    
    // Data rows
    data.forEach(item => {
      csvContent += `${item.date},${item.client},${item.service},${item.staff},$${item.amount.toFixed(2)},${item.paymentMethod}\n`;
    });
    
    // Total
    const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
    csvContent += `\nTotal:,,,$${totalAmount.toFixed(2)},\n`;
    
    // Create blob and download (support mobile export)
    const filename = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw error;
  }
};

// Reports & Analytics Export Interfaces
export interface AnalyticsReportData {
  period: string;
  revenue: {
    total: number;
    cash: number;
    card: number;
    online: number;
  };
  serviceRevenue: Array<{
    service: string;
    revenue: number;
    percentage: number;
  }>;
  staffPerformance: Array<{
    staff: string;
    bookings: number;
    revenue: number;
    rating: number;
  }>;
  popularServices: Array<{
    service: string;
    count: number;
    trend: string;
  }>;
  operationalMetrics: {
    staffUtilization: number;
    noShowRate: number;
    avgServiceDuration: number;
    peakBookingTime: string;
  };
}

export const exportAnalyticsToPDF = async (data: AnalyticsReportData, businessName: string) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`${businessName} - Reports & Analytics`, 14, 20);
  
  // Add period
  doc.setFontSize(10);
  doc.text(`Period: ${data.period}`, 14, 28);
  
  // Add generation date
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 34);
  
  let startY = 45;
  
  // Revenue Overview
  doc.setFontSize(14);
  doc.text("Revenue Overview", 14, startY);
  startY += 8;
  
  autoTable(doc, {
    startY: startY,
    head: [['Payment Method', 'Amount', 'Percentage']],
    body: [
      ['Total', `$${data.revenue.total.toFixed(2)}`, '100%'],
      ['Cash', `$${data.revenue.cash.toFixed(2)}`, data.revenue.total > 0 ? `${((data.revenue.cash / data.revenue.total) * 100).toFixed(1)}%` : '0%'],
      ['Card', `$${data.revenue.card.toFixed(2)}`, data.revenue.total > 0 ? `${((data.revenue.card / data.revenue.total) * 100).toFixed(1)}%` : '0%'],
      ['Online', `$${data.revenue.online.toFixed(2)}`, data.revenue.total > 0 ? `${((data.revenue.online / data.revenue.total) * 100).toFixed(1)}%` : '0%']
    ],
    theme: 'grid',
    headStyles: { fillColor: [147, 135, 245] }
  });
  
  startY = (doc as any).lastAutoTable.finalY + 15;
  
  // Service Revenue
  if (data.serviceRevenue.length > 0) {
    doc.setFontSize(14);
    doc.text("Top Services by Revenue", 14, startY);
    startY += 8;
    
    autoTable(doc, {
      startY: startY,
      head: [['Service', 'Revenue', 'Percentage']],
      body: data.serviceRevenue.map(item => [
        item.service,
        `$${item.revenue.toFixed(2)}`,
        `${item.percentage}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [147, 135, 245] }
    });
    
    startY = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Staff Performance
  if (data.staffPerformance.length > 0) {
    doc.setFontSize(14);
    doc.text("Staff Performance", 14, startY);
    startY += 8;
    
    autoTable(doc, {
      startY: startY,
      head: [['Staff', 'Bookings', 'Revenue', 'Rating']],
      body: data.staffPerformance.map(item => [
        item.staff,
        String(item.bookings),
        `$${item.revenue.toFixed(2)}`,
        item.rating.toFixed(1)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [147, 135, 245] }
    });
    
    startY = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Operational Metrics
  doc.setFontSize(14);
  doc.text("Operational Metrics", 14, startY);
  startY += 8;
  
  autoTable(doc, {
    startY: startY,
    head: [['Metric', 'Value']],
    body: [
      ['Staff Utilization', `${data.operationalMetrics.staffUtilization}%`],
      ['No-Show Rate', `${data.operationalMetrics.noShowRate}%`],
      ['Avg Service Duration', `${data.operationalMetrics.avgServiceDuration} min`],
      ['Peak Booking Time', data.operationalMetrics.peakBookingTime]
    ],
    theme: 'grid',
    headStyles: { fillColor: [147, 135, 245] }
  });
  
  // Save the PDF (use blob download for better mobile compatibility)
  const filename = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  try {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.warn('Blob download failed, falling back to direct save', error);
    doc.save(filename);
  }
};

export const exportAnalyticsToExcel = async (data: AnalyticsReportData, businessName: string) => {
  const wb = XLSX.utils.book_new();
  
  // Revenue Overview Sheet
  const revenueData = [
    [`${businessName} - Reports & Analytics`],
    [`Period: ${data.period}`],
    [`Generated: ${format(new Date(), "PPP")}`],
    [],
    ['Revenue Overview'],
    ['Payment Method', 'Amount', 'Percentage'],
    ['Total', data.revenue.total, '100%'],
    ['Cash', data.revenue.cash, data.revenue.total > 0 ? `${((data.revenue.cash / data.revenue.total) * 100).toFixed(1)}%` : '0%'],
    ['Card', data.revenue.card, data.revenue.total > 0 ? `${((data.revenue.card / data.revenue.total) * 100).toFixed(1)}%` : '0%'],
    ['Online', data.revenue.online, data.revenue.total > 0 ? `${((data.revenue.online / data.revenue.total) * 100).toFixed(1)}%` : '0%'],
    [],
    ['Top Services by Revenue'],
    ['Service', 'Revenue', 'Percentage'],
    ...data.serviceRevenue.map(item => [item.service, item.revenue, `${item.percentage}%`]),
    [],
    ['Staff Performance'],
    ['Staff', 'Bookings', 'Revenue', 'Rating'],
    ...data.staffPerformance.map(item => [item.staff, item.bookings, item.revenue, item.rating]),
    [],
    ['Operational Metrics'],
    ['Metric', 'Value'],
    ['Staff Utilization', `${data.operationalMetrics.staffUtilization}%`],
    ['No-Show Rate', `${data.operationalMetrics.noShowRate}%`],
    ['Avg Service Duration', `${data.operationalMetrics.avgServiceDuration} min`],
    ['Peak Booking Time', data.operationalMetrics.peakBookingTime]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(revenueData);
  ws['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Analytics Report');
  
  // Save file (use blob download for better mobile compatibility)
  const filename = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  try {
    const excelArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.warn('Blob download failed, falling back to direct save', error);
    XLSX.writeFile(wb, filename);
  }
};

export const exportAnalyticsToCSV = async (data: AnalyticsReportData, businessName: string) => {
  try {
    let csvContent = `${businessName} - Reports & Analytics\n`;
    csvContent += `Period: ${data.period}\n`;
    csvContent += `Generated: ${format(new Date(), "PPP")}\n\n`;
    
    // Revenue Overview
    csvContent += `Revenue Overview\n`;
    csvContent += `Payment Method,Amount,Percentage\n`;
    csvContent += `Total,$${data.revenue.total.toFixed(2)},100%\n`;
    csvContent += `Cash,$${data.revenue.cash.toFixed(2)},${data.revenue.total > 0 ? ((data.revenue.cash / data.revenue.total) * 100).toFixed(1) : 0}%\n`;
    csvContent += `Card,$${data.revenue.card.toFixed(2)},${data.revenue.total > 0 ? ((data.revenue.card / data.revenue.total) * 100).toFixed(1) : 0}%\n`;
    csvContent += `Online,$${data.revenue.online.toFixed(2)},${data.revenue.total > 0 ? ((data.revenue.online / data.revenue.total) * 100).toFixed(1) : 0}%\n\n`;
    
    // Service Revenue
    csvContent += `Top Services by Revenue\n`;
    csvContent += `Service,Revenue,Percentage\n`;
    data.serviceRevenue.forEach(item => {
      csvContent += `${item.service},$${item.revenue.toFixed(2)},${item.percentage}%\n`;
    });
    csvContent += `\n`;
    
    // Staff Performance
    csvContent += `Staff Performance\n`;
    csvContent += `Staff,Bookings,Revenue,Rating\n`;
    data.staffPerformance.forEach(item => {
      csvContent += `${item.staff},${item.bookings},$${item.revenue.toFixed(2)},${item.rating.toFixed(1)}\n`;
    });
    csvContent += `\n`;
    
    // Operational Metrics
    csvContent += `Operational Metrics\n`;
    csvContent += `Metric,Value\n`;
    csvContent += `Staff Utilization,${data.operationalMetrics.staffUtilization}%\n`;
    csvContent += `No-Show Rate,${data.operationalMetrics.noShowRate}%\n`;
    csvContent += `Avg Service Duration,${data.operationalMetrics.avgServiceDuration} min\n`;
    csvContent += `Peak Booking Time,${data.operationalMetrics.peakBookingTime}\n`;
    
    // Create blob and download (use blob download for better mobile compatibility)
    const filename = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw error;
  }
};

export const exportCommissionsToPDF = (data: CommissionReportData[], businessName: string) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(`${businessName} - Commission Report`, 14, 20);
  
  // Add generation date
  doc.setFontSize(8);
  doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 28);
  
  // Calculate totals
  const totalSales = data.reduce((sum, item) => sum + item.totalSales, 0);
  const totalCommissions = data.reduce((sum, item) => sum + item.commissionAmount, 0);
  
  // Add table
  autoTable(doc, {
    startY: 35,
    head: [['Staff Member', 'Period', 'Total Sales', 'Rate', 'Commission']],
    body: data.map(item => [
      item.staff,
      item.period,
      `$${item.totalSales.toFixed(2)}`,
      `${item.commissionRate}%`,
      `$${item.commissionAmount.toFixed(2)}`
    ]),
    foot: [[
      '',
      'Total:',
      `$${totalSales.toFixed(2)}`,
      '',
      `$${totalCommissions.toFixed(2)}`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [147, 135, 245] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });
  
  // Save the PDF
  doc.save(`commission-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

export const exportCommissionsToExcel = (data: CommissionReportData[], businessName: string) => {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Calculate totals
  const totalSales = data.reduce((sum, item) => sum + item.totalSales, 0);
  const totalCommissions = data.reduce((sum, item) => sum + item.commissionAmount, 0);
  
  // Prepare data with headers
  const wsData = [
    [`${businessName} - Commission Report`],
    [`Generated: ${format(new Date(), "PPP")}`],
    [], // Empty row
    ['Staff Member', 'Period', 'Total Sales', 'Commission Rate', 'Commission Amount'],
    ...data.map(item => [
      item.staff,
      item.period,
      item.totalSales,
      `${item.commissionRate}%`,
      item.commissionAmount
    ]),
    [], // Empty row
    ['', 'Total:', totalSales, '', totalCommissions]
  ];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Staff
    { wch: 20 }, // Period
    { wch: 15 }, // Total Sales
    { wch: 15 }, // Rate
    { wch: 15 }  // Commission
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Commission Report');
  
  // Save file
  XLSX.writeFile(wb, `commission-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
};

export interface DailySalesSummaryData {
  date: string;
  transactionSummary: {
    itemType: string;
    salesQty: number;
    refundQty: number;
    grossTotal: number;
  }[];
  cashMovement: {
    paymentType: string;
    paymentsCollected: number;
    refundsPaid: number;
  }[];
}

export const exportDailySummaryToPDF = async (data: DailySalesSummaryData, businessName: string) => {
  try {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`${businessName} - Daily Sales Summary`, 14, 20);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Date: ${data.date}`, 14, 28);
    
    // Add generation date
    doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 34);
    
    let startY = 45;
    
    // Transaction Summary Table
    doc.setFontSize(12);
    doc.text("Transaction Summary", 14, startY);
    startY += 8;
    
    if (data.transactionSummary && data.transactionSummary.length > 0) {
      autoTable(doc, {
        startY: startY,
        head: [['Item Type', 'Sales Qty', 'Refund Qty', 'Gross Total']],
        body: data.transactionSummary.map(item => [
          item.itemType || '-',
          String(item.salesQty || 0),
          String(item.refundQty || 0),
          `DOP ${(item.grossTotal || 0).toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [147, 135, 245] },
      });
      
      startY = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Cash Movement Summary Table
    doc.setFontSize(12);
    doc.text("Cash Movement Summary", 14, startY);
    startY += 8;
    
    if (data.cashMovement && data.cashMovement.length > 0) {
      autoTable(doc, {
        startY: startY,
        head: [['Payment Type', 'Payments Collected', 'Refunds Paid']],
        body: data.cashMovement.map(item => [
          item.paymentType || '-',
          `DOP ${(item.paymentsCollected || 0).toFixed(2)}`,
          `DOP ${(item.refundsPaid || 0).toFixed(2)}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [147, 135, 245] },
      });
    }
    
    // Save the PDF (use native filesystem on device if possible)
    const dateStr = data.date ? format(new Date(data.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    if (Capacitor.isNativePlatform()) {
      try {
        const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
        const base64 = arrayBufferToBase64(arrayBuffer);
        await writeBase64ToDevice(`daily-sales-summary-${dateStr}.pdf`, base64, 'application/pdf');
        return;
      } catch (error) {
        console.warn('Native save failed, falling back to browser download', error);
      }
    }
    doc.save(`daily-sales-summary-${dateStr}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF. Please try again.");
  }
};

export const exportDailySummaryToExcel = async (data: DailySalesSummaryData, businessName: string) => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Transaction Summary Sheet
    const transactionData = [
      [`${businessName} - Daily Sales Summary`],
      [`Date: ${data.date || 'N/A'}`],
      [`Generated: ${format(new Date(), "PPP")}`],
      [],
      ['Transaction Summary'],
      ['Item Type', 'Sales Qty', 'Refund Qty', 'Gross Total'],
      ...(data.transactionSummary || []).map(item => [
        item.itemType || '-',
        item.salesQty || 0,
        item.refundQty || 0,
        item.grossTotal || 0
      ]),
      [],
      ['Cash Movement Summary'],
      ['Payment Type', 'Payments Collected', 'Refunds Paid'],
      ...(data.cashMovement || []).map(item => [
        item.paymentType || '-',
        item.paymentsCollected || 0,
        item.refundsPaid || 0
      ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(transactionData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Item Type / Payment Type
      { wch: 15 }, // Sales Qty / Payments Collected
      { wch: 15 }, // Refund Qty / Refunds Paid
      { wch: 15 }  // Gross Total
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary');
    const dateStr = data.date ? format(new Date(data.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await writeBase64ToDevice(`daily-sales-summary-${dateStr}.xlsx`, base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return;
      } catch (error) {
        console.warn('Native save failed, falling back to browser download', error);
      }
    }
    XLSX.writeFile(wb, `daily-sales-summary-${dateStr}.xlsx`);
  } catch (error) {
    console.error("Error generating Excel:", error);
    throw new Error("Failed to generate Excel. Please try again.");
  }
};

export const exportDailySummaryToCSV = (data: DailySalesSummaryData, businessName: string) => {
  try {
    // Create CSV content
    let csvContent = `${businessName} - Daily Sales Summary\n`;
    csvContent += `Date: ${data.date || 'N/A'}\n`;
    csvContent += `Generated: ${format(new Date(), "PPP")}\n\n`;
    
    // Transaction Summary
    csvContent += `Transaction Summary\n`;
    csvContent += `Item Type,Sales Qty,Refund Qty,Gross Total\n`;
    (data.transactionSummary || []).forEach(item => {
      csvContent += `${item.itemType || '-'},${item.salesQty || 0},${item.refundQty || 0},DOP ${(item.grossTotal || 0).toFixed(2)}\n`;
    });
    
    csvContent += `\n`;
    
    // Cash Movement Summary
    csvContent += `Cash Movement Summary\n`;
    csvContent += `Payment Type,Payments Collected,Refunds Paid\n`;
    (data.cashMovement || []).forEach(item => {
      csvContent += `${item.paymentType || '-'},DOP ${(item.paymentsCollected || 0).toFixed(2)},DOP ${(item.refundsPaid || 0).toFixed(2)}\n`;
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const dateStr = data.date ? format(new Date(data.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    link.setAttribute('download', `daily-sales-summary-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw new Error("Failed to generate CSV. Please try again.");
  }
};