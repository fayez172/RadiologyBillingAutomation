import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const mappings = await prisma.mapping.findMany({
      orderBy: [
        { modality: 'asc' },
        { priority: 'desc' },
        { procedure_pattern: 'asc' }
      ]
    });

    const data = mappings.map(m => ({
      'Modality': m.modality,
      'Procedure Pattern': m.procedure_pattern,
      'Is Regex': m.is_regex ? 'Yes' : 'No',
      'Client Billing Type': m.type,
      'Radiologist Billing Type': m.type_dr,
      'Priority': m.priority,
      'Active': m.is_active ? 'Yes' : 'No'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-calculate column widths
    const colWidths = [
      { wch: 10 }, // Modality
      { wch: 40 }, // Procedure Pattern
      { wch: 10 }, // Is Regex
      { wch: 25 }, // Client Billing Type
      { wch: 25 }, // Radiologist Billing Type
      { wch: 10 }, // Priority
      { wch: 10 }  // Active
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Mappings');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="mappings_export_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (err: any) {
    console.error('[MAPPINGS_EXPORT_GET]', err);
    return new Response('Failed to export mappings', { status: 500 });
  }
}
