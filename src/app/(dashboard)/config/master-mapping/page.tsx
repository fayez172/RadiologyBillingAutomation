"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Save, Layers, ListChecks, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function MasterMappingPage() {
  const [items, setItems] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unmappedRes, typesRes] = await Promise.all([
        fetch('/api/config/unmapped-procedures'),
        fetch('/api/config/billing-types')
      ]);
      
      if (unmappedRes.ok && typesRes.ok) {
        setItems((await unmappedRes.json()).data);
        setTypes(await typesRes.json());
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load mapping data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (modality: string, procedure_raw: string, typeName: string) => {
    setSaving(`${modality}-${procedure_raw}`);
    try {
      const res = await fetch('/api/config/unmapped-procedures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedure_raw,
          type: typeName
        })
      });

      if (res.ok) {
        toast.success(`Mapped all instances of "${procedure_raw}"`);
        // Remove from list
        setItems(prev => prev.filter(i => !(i.modality === modality && i.procedure_raw === procedure_raw)));
      } else {
        toast.error("Failed to save mapping");
      }
    } catch (e) {
      toast.error("Connection error");
    } finally {
      setSaving(null);
    }
  };

  const filtered = items.filter(i => 
    i.procedure_raw?.toLowerCase().includes(search.toLowerCase()) ||
    i.modality?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Mapping</h1>
          <p className="text-muted-foreground">Aggregate unique unmapped procedures and map them in bulk.</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <Layers className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Unique Procedures</div>
            <div className="text-lg font-mono font-bold leading-none">{items.length}</div>
          </div>
        </div>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" /> Unmapped Proposals
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter procedures..."
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
                <TableHead>Modality</TableHead>
                <TableHead className="min-w-[300px]">Original Procedure Name</TableHead>
                <TableHead className="text-center">Study Count</TableHead>
                <TableHead className="w-[250px]">Assign Billing Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Analyzing studies...</p>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20 text-emerald-500" />
                    <p className="text-lg font-medium">All procedures are mapped!</p>
                    <p className="text-sm">Great job. Check back after the next sync.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item, idx) => (
                  <TableRow key={`${item.modality}-${item.procedure_raw}-${idx}`} className="border-border/50 group hover:bg-white/5 transition-colors">
                    <TableCell>
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {item.modality}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium italic group-hover:text-primary transition-colors">
                        {item.procedure_raw}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex flex-col">
                        <span className="text-sm font-bold font-mono text-emerald-400">{item.count}</span>
                        <span className="text-[9px] uppercase text-muted-foreground font-bold">Affected</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        disabled={saving === `${item.modality}-${item.procedure_raw}`}
                        onValueChange={(val: string | null) => val && handleAssign(item.modality, item.procedure_raw, val)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background/50 border-border/50">
                          <SelectValue placeholder="Select Type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {types
                            .filter(t => t.modalities.includes(item.modality))
                            .map(t => (
                              <SelectItem key={t.id} value={t.name}>{t.display_name}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
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
