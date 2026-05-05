"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, FileSpreadsheet, RefreshCw, User, Building2, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { formatBDT } from '@/lib/date-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export default function StudiesPage() {
  const [studies, setStudies] = useState<any[]>([]);
  const [availableModalities, setAvailableModalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date('2026-02-01')), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date('2026-02-01')), 'yyyy-MM-dd'));
  const [modality, setModality] = useState('ALL');
  const [hospital, setHospital] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  useEffect(() => {
    fetchStudies();
  }, [startDate, endDate, modality, hospital, status]);

  useEffect(() => {
    fetch('/api/reference/modalities')
      .then(res => res.json())
      .then(data => setAvailableModalities(data.data || []))
      .catch(console.error);
  }, []);

  const fetchStudies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: '1000'
      });
      if (search) params.append('search', search);
      if (modality !== 'ALL') params.append('modality', modality);
      if (hospital !== 'ALL') params.append('hospital', hospital);
      if (status !== 'ALL') params.append('status', status.toLowerCase());

      const res = await fetch(`/api/studies?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setStudies(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = studies.map(s => ({
      'MRN': s.mrn || 'N/A',
      'Patient Name': s.patient_name || 'Unknown',
      'Hospital Name': s.hospital_name,
      'Modality': s.modality,
      'Procedure Name': s.procedure_raw,
      'Mapped Type': s.type || 'UNMAPPED',
      'Radiologist': s.final_rad_name || 'Pending',
      'Report Date (BDT)': s.report_dt ? formatBDT(s.report_dt) : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Studies Export');
    XLSX.writeFile(workbook, `TeleRad_Studies_BDT_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Studies Explorer</h1>
          <p className="text-muted-foreground">Advanced query and export for all synced radiology records.</p>
        </div>
        
        <div className="flex gap-2">
          <Link href="/studies/reports">
            <Button variant="outline" className="border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400">
              <FileText className="h-4 w-4 mr-2" /> Billing Reports
            </Button>
          </Link>
          <Button onClick={fetchStudies} variant="outline" className="border-border/50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={exportToExcel} disabled={studies.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Quick Export (BDT)
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader className="flex flex-col space-y-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date Range</label>
              <div className="flex items-center gap-1">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-background/50" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-background/50" />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Modality</label>
              <Select value={modality} onValueChange={(val: string | null) => setModality(val || 'ALL')}>
                <SelectTrigger className="h-9 text-xs bg-background/50 border-border/50">
                  <SelectValue placeholder="All Modalities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Modalities</SelectItem>
                  {availableModalities.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Status</label>
              <Select value={status} onValueChange={(val: string | null) => setStatus(val || 'ALL')}>
                <SelectTrigger className="h-9 text-xs bg-background/50 border-border/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Records</SelectItem>
                  <SelectItem value="MAPPED">Mapped Only</SelectItem>
                  <SelectItem value="UNMAPPED">Unmapped Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 lg:col-span-1 md:col-span-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Search Keywords</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Patient, MRN, Procedure..."
                  className="pl-8 h-9 text-xs bg-background/50 border-border/50"
                  value={search}
                  onKeyDown={(e) => e.key === 'Enter' && fetchStudies()}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-[calc(100vh-350px)] overflow-auto border rounded-md custom-scrollbar bg-black/40 shadow-inner">
            <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur shadow-sm">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[200px] font-bold py-4 text-foreground">Patient & MRN</TableHead>
                <TableHead className="font-bold text-foreground">Hospital</TableHead>
                <TableHead className="w-[80px] font-bold text-foreground">Modality</TableHead>
                <TableHead className="max-w-[200px] font-bold text-foreground">Procedure Name</TableHead>
                <TableHead className="font-bold text-foreground">Mapping</TableHead>
                <TableHead className="text-right font-bold text-foreground">Report Date (BDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto opacity-50" />
                    <p className="mt-2 text-xs">Querying database...</p>
                  </TableCell>
                </TableRow>
              ) : studies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>No studies found for this criteria.</p>
                  </TableCell>
                </TableRow>
              ) : (
                studies.map((s) => (
                  <TableRow key={s.id} className="border-border/50 group hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-sm group-hover:text-primary transition-colors">{s.patient_name || 'Unknown'}</div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                        <User className="h-3 w-3" /> {s.mrn || 'NO MRN'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                       <div className="flex items-center gap-1.5">
                         <Building2 className="h-3 w-3 text-muted-foreground" />
                         {s.hospital_name}
                       </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {s.modality}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                      <div className="text-[11px] italic text-muted-foreground leading-snug" title={s.procedure_raw}>
                        {s.procedure_raw}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.type ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                            {s.type}
                          </span>
                          <span className="text-[9px] text-muted-foreground ml-1 font-medium">Auto-Mapped</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          UNMAPPED
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-[11px] font-mono font-medium">{formatBDT(s.report_dt, 'dd MMM yyyy')}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBDT(s.report_dt, 'HH:mm:ss')}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
