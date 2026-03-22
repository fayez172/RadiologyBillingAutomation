'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Loader2, Calculator, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InvoiceBuilderPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [periodStart, setPeriodStart] = useState(firstDay);
  const [periodEnd, setPeriodEnd] = useState(lastDay);
  
  const [draft, setDraft] = useState<any>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/config/clients');
      if (res.ok) setClients((await res.json()).data);
    } catch (e) {
      console.error(e);
    }
  };

  const generateDraft = async () => {
    if (!selectedClient || !periodStart || !periodEnd) {
      toast({ title: 'Error', description: 'Please select a client and date range.', variant: 'destructive' });
      return;
    }
    
    setLoadingDraft(true);
    setDraft(null);
    try {
      const res = await fetch('/api/invoices/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient,
          period_start: periodStart,
          period_end: periodEnd
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to generate draft');
      setDraft(data.data);
      toast({ title: 'Draft Generated', description: 'Review the invoice lines below before finalizing.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingDraft(false);
    }
  };

  const finalizeInvoice = async () => {
    if (!draft) return;
    setFinalizing(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: draft.client_id,
          period_start: draft.period_start,
          period_end: draft.period_end,
          subtotal: draft.subtotal,
          previous_due: draft.previous_due,
          total_due: draft.total_due,
          lines: draft.lines
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to finalize invoice');
      
      toast({ title: 'Success', description: 'Invoice finalized and saved to ledger.' });
      router.push('/invoices');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/invoices" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Builder</h1>
          <p className="text-muted-foreground">Generate billing statements based on study volume and pricing rules.</p>
        </div>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Billing Parameters</CardTitle>
          <CardDescription>Select the hospital and the specific date range to bill for.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Hospital / Client</Label>
              <Select value={selectedClient} onValueChange={(value: string | null) => { setSelectedClient(value || ''); setDraft(null); }}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select a hospital..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period Start Date</Label>
              <Input type="date" value={periodStart} onChange={e => { setPeriodStart(e.target.value); setDraft(null); }} />
            </div>
            <div className="space-y-2">
              <Label>Period End Date</Label>
              <Input type="date" value={periodEnd} onChange={e => { setPeriodEnd(e.target.value); setDraft(null); }} />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={generateDraft} disabled={loadingDraft || !selectedClient} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
            {loadingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Calculate & Draft Invoice
          </Button>
        </CardFooter>
      </Card>

      {draft && (
        <Card className="border-blue-900/50 bg-blue-950/10 backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <CardTitle className="text-2xl text-blue-400">Invoice Draft Preview</CardTitle>
                <CardDescription className="text-blue-400/70 mt-1">
                  {draft.client_name} • {format(new Date(draft.period_start), 'MMM dd, yyyy')} to {format(new Date(draft.period_end), 'MMM dd, yyyy')}
                </CardDescription>
              </div>
              <Button onClick={finalizeInvoice} disabled={finalizing} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg mt-4 md:mt-0">
                {finalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Finalize & Save Invoice
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Study Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price (BDT)</TableHead>
                  <TableHead className="text-right">Line Total (BDT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                      No billable studies found for this client in the selected date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  draft.lines.map((line: any, idx: number) => (
                    <TableRow key={idx} className="border-border/50">
                      <TableCell className="font-medium">{line.type}</TableCell>
                      <TableCell className="text-right">{line.qty}</TableCell>
                      <TableCell className="text-right">৳{Number(line.unit_price).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">৳{Number(line.total).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
                
                {draft.lines.length > 0 && (
                  <>
                    <TableRow className="border-t-2 border-border/50 hover:bg-transparent">
                      <TableCell colSpan={3} className="text-right font-medium text-muted-foreground">Subtotal (This Period)</TableCell>
                      <TableCell className="text-right font-bold">৳{Number(draft.subtotal).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell colSpan={3} className="text-right font-medium text-muted-foreground flex items-center justify-end gap-2">
                        <span>Previous Outstanding Due</span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-orange-400">
                        ৳{Number(draft.previous_due).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 border-border hover:bg-transparent">
                      <TableCell colSpan={3} className="text-right font-bold text-lg text-blue-400">Total Amount Due</TableCell>
                      <TableCell className="text-right font-bold text-xl text-blue-400">৳{Number(draft.total_due).toLocaleString()}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
