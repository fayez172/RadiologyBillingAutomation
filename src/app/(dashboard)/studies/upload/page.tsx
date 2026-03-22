import { prisma } from '@/lib/prisma';
import UploadClient from './upload-client';

export const metadata = {
  title: 'Upload Studies | TeleRadiology Billing',
};

export default async function UploadStudiesPage() {
  const instances = await prisma.dbInstance.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, is_active: true }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Studies</h1>
        <p className="text-muted-foreground mt-2">
          Import study data from CSV or XLSX files. You must select the target database instance first.
        </p>
      </div>

      <UploadClient instances={instances} />
    </div>
  );
}
