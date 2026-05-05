'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileSpreadsheet, FileText, Download, User, Building2, Calendar, CheckSquare, Square } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function StudyReportsPage() {
  const [entityType, setEntityType] = useState<'radiologist' | 'hospital'>('hospital');
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  
  // Date range
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEntities();
  }, [entityType]);

  const fetchEntities = async () => {
    setLoadingEntities(true);
    setSelectedIds([]);
    try {
      const endpoint = entityType === 'radiologist' ? '/api/config/radiologists' : '/api/config/clients';
      const res = await fetch(endpoint);
      const data = await res.json();
      setEntities(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEntities(false);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === entities.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entities.map(e => e.id));
    }
  };

  const toggleEntity = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    if (selectedIds.length === 0) {
      toast({ title: 'Selection Required', description: `Please select at least one ${entityType}.`, variant: 'warning' } as any);
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        entityType,
        entityIds: selectedIds.length === entities.length ? 'all' : selectedIds,
        startDate,
        endDate,
        format
      };

      const endpoint = `/api/reports/studies/${format}`; // pdf has its own route, xlsx uses /api/reports/studies/export? NO, I made it separately for clarity if needed but I can unify.
      // Wait, I created /api/reports/studies/export/route.ts for XLSX and /api/reports/studies/pdf/route.ts for PDF.
      const url = format === 'xlsx' ? '/api/reports/studies/export' : '/api/reports/studies/pdf';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `Report_${format === 'xlsx' ? 'Excel' : 'PDF'}.${format}`;
      if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
      toast({ title: 'Download Successful', description: `Your ${format.toUpperCase()} report has been generated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing Detail Reports</h1>
        <p className="text-muted-foreground">Download granular study lists for individual or multiple entities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Scope</CardTitle>
              <CardDescription>Who are we generating for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/30 rounded-lg">
                  <Button 
                    variant={entityType === 'hospital' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setEntityType('hospital')}
                    className="h-8"
                  >
                    <Building2 className="w-4 h-4 mr-2" /> Hospital
                  </Button>
                  <Button 
                    variant={entityType === 'radiologist' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setEntityType('radiologist')}
                    className="h-8"
                  >
                    <User className="w-4 h-4 mr-2" /> Radiologist
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Report Period (BDT)</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-8 bg-background/50 h-9" />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-8 bg-background/50 h-9" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 bg-black/20 backdrop-blur-xl flex flex-col h-full min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/10">
              <div>
                <CardTitle className="text-lg">Step 2: Selection</CardTitle>
                <CardDescription>Select single, multiple, or all {entityType}s.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAll} className="h-8 px-2">
                {selectedIds.length === entities.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-4 space-y-2 custom-scrollbar pr-2">
              {loadingEntities ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin opacity-50 mb-2" />
                  <p className="text-sm">Loading list...</p>
                </div>
              ) : entities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground italic">
                  No {entityType}s found in the system.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entities.map(e => (
                    <div 
                      key={e.id} 
                      onClick={() => toggleEntity(e.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                        selectedIds.includes(e.id) 
                          ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20' 
                          : 'border-border/50 bg-secondary/10 hover:border-border hover:bg-secondary/20'
                      }`}
                    >
                      {selectedIds.includes(e.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground opacity-30 group-hover:opacity-60" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                          {entityType === 'hospital' ? 'Hospital' : 'Doctor'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border/10 pt-4 bg-background/20">
              <div className="flex w-full gap-4">
                <Button 
                  onClick={() => handleDownload('xlsx')} 
                  disabled={generating || selectedIds.length === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                >
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                  Download Excel
                </Button>
                <Button 
                  onClick={() => handleDownload('pdf')} 
                  disabled={generating || selectedIds.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                >
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Download PDF
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
