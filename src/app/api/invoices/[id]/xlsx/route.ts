import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        lines: { orderBy: { type: 'asc' } }
      }
    });

    if (!invoice) return new Response('Invoice not found', { status: 404 });

    // Prepare data for Excel
    const data = invoice.lines.map((line: any) => ({
      'Study Type': line.type,
      'Quantity': line.qty,
      'Unit Price (BDT)': Number(line.unit_price),
      'Line Total (BDT)': Number(line.total)
    }));

    // Add summary rows
    data.push({ 'Study Type': '', 'Quantity': null, 'Unit Price (BDT)': null, 'Line Total (BDT)': null } as any);
    data.push({ 'Study Type': 'Subtotal (This Period)', 'Quantity': null, 'Unit Price (BDT)': null, 'Line Total (BDT)': Number(invoice.subtotal) } as any);
    data.push({ 'Study Type': 'Previous Outstanding Due', 'Quantity': null, 'Unit Price (BDT)': null, 'Line Total (BDT)': Number(invoice.previous_due) } as any);
    data.push({ 'Study Type': 'TOTAL DUE', 'Quantity': null, 'Unit Price (BDT)': null, 'Line Total (BDT)': Number(invoice.total_due) } as any);

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Invoice ${invoice.invoice_number}`);

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Invoice_${invoice.invoice_number}.xlsx"`
      }
    });
  } catch (err: any) {
    console.error('[INVOICE_XLSX_GET]', err);
    return new Response('Failed to generate Excel file', { status: 500 });
  }
}
