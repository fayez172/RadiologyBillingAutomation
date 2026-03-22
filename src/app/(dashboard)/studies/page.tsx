'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Loader2, Download, Search, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function StudiesPage() {
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studies'); // Note: Reuses the mappings queue or instance queue API, we will just fetch 100 recent
      if (res.ok) setStudies((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = studies.map(s => ({
      'MRN': s.patient_mrn,
      'Patient Name': s.patient_name,
      'Hospital Name': s.hospital_name,
      'Modality': s.modality,
      'Procedure Name': s.procedure_name,
      'Mapped Type': s.type || 'UNMAPPED',
      'Radiologist': s.radiologist,
      'Report Date': format(new Date(s.report_dt), 'dd-MMM-yyyy HH:mm:ss')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Studies Export');
    XLSX.writeFile(workbook, `TeleRad_Studies_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const filtered = studies.filter(s => 
    (s.patient_name?.toLowerCase().includes(search.toLowerCase()) || '') ||
    (s.hospital_name?.toLowerCase().includes(search.toLowerCase()) || '') ||
    (s.type?.toLowerCase().includes(search.toLowerCase()) || '')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Studies Explorer</h1>
          <p className="text-muted-foreground">View and export all synced radiology reports across all hospitals.</p>
        </div>
        
        <Button onClick={exportToExcel} disabled={studies.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Global Study Records</CardTitle>
            <CardDescription>Recent {studies.length} studies ingested into the system.</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search patient, hospital, type..."
              className="pl-8 bg-background/50 border-border/50 focus-visible:ring-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>MRN & Patient Name</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Original Procedure</TableHead>
                <TableHead>Mapped Type</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No studies found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 100).map((s) => (
                  <TableRow key={s.id} className="border-border/50">
                    <TableCell>
                      <div className="font-medium">{s.patient_name}</div>
                      <div className="text-xs text-muted-foreground">MRN: {s.patient_mrn}</div>
                    </TableCell>
                    <TableCell>{s.hospital_name}</TableCell>
                    <TableCell>{s.modality}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={s.procedure_name}>{s.procedure_name}</TableCell>
                    <TableCell>
                      {s.type ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {s.type}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20">
                          UNMAPPED
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {format(new Date(s.report_dt), 'dd-MMM-yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
