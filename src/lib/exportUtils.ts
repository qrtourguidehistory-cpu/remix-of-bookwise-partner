import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

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

export const exportSalesToPDF = (data: SalesReportData[], businessName: string, startDate?: string, endDate?: string) => {
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
  
  // Save the PDF
  doc.save(`sales-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

export const exportSalesToExcel = (data: SalesReportData[], businessName: string, startDate?: string, endDate?: string) => {
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
  
  // Save file
  XLSX.writeFile(wb, `sales-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
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

export const exportDailySummaryToPDF = (data: DailySalesSummaryData, businessName: string) => {
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
    
    // Save the PDF
    const dateStr = data.date ? format(new Date(data.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    doc.save(`daily-sales-summary-${dateStr}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF. Please try again.");
  }
};

export const exportDailySummaryToExcel = (data: DailySalesSummaryData, businessName: string) => {
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