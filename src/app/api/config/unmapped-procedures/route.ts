import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Unmapped = procedures where billing_type IS NULL
    const unmappedProcedures = await prisma.remoteProcedure.findMany({
      where: {
        billing_type: null,
        is_active: true
      },
      include: {
        parent_modality: true
      }
    });

    // Group by modality and procedure name
    const grouped = new Map();
    unmappedProcedures.forEach((proc: any) => {
      const modality = proc.parent_modality?.code || proc.parent_modality?.display_name || 'UNKNOWN';
      const key = `${modality}-${proc.name}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          modality,
          procedure_raw: proc.name,
          count: 1 // We could count the number of instances having this unmapped
        });
      } else {
        const existing = grouped.get(key);
        existing.count += 1;
      }
    });

    const result = Array.from(grouped.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('API Error [UnmappedProcedures GET]:', error);
    return NextResponse.json({ error: 'Failed to fetch unmapped procedures' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { procedure_raw, type } = body;

    if (!procedure_raw || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update all matching remote procedures
    await prisma.remoteProcedure.updateMany({
      where: {
        name: procedure_raw,
        is_active: true
      },
      data: {
        billing_type: type,
        billing_type_dr: type,
      }
    });

    // Auto-create persistent mapping records so future studies are auto-mapped
    // Find all distinct modalities for this procedure_raw to create specific mappings
    const distinctProcedures = await prisma.remoteProcedure.findMany({
      where: { name: procedure_raw, is_active: true },
      include: { parent_modality: true }
    });
    
    // Group by modality code/name
    const modalities = Array.from(new Set(distinctProcedures.map(p => 
      p.parent_modality?.code || p.parent_modality?.display_name || 'UNKNOWN'
    )));

    for (const mod of modalities) {
      await prisma.mapping.upsert({
        where: {
          modality_procedure_pattern: {
            modality: mod,
            procedure_pattern: procedure_raw
          }
        },
        update: {
          type: type,
          type_dr: type,
        },
        create: {
          modality: mod,
          procedure_pattern: procedure_raw,
          type: type,
          type_dr: type,
          priority: 100 // High priority for manual master mappings
        }
      });
    }
    
    // Attempt background remap of studies
    import('@/lib/mapping-engine').then(m => m.mapUnmappedStudies()).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error [UnmappedProcedures PUT]:', error);
    return NextResponse.json({ error: 'Failed to assign billing type' }, { status: 500 });
  }
}
