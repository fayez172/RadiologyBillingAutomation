'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Loader2, Plus, Receipt, History } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PaymentsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientData, setClientData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [formData, setFormData] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], reference: '', note: '' });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      setClientData(client);
      fetchPayments(selectedClient);
    } else {
      setClientData(null);
      setPayments([]);
    }
  }, [selectedClient, clients]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/clients');
      if (res.ok) setClients((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async (clientId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/clients/${clientId}/payments`);
      if (res.ok) setPayments((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const savePayment = async () => {
    setSubmitting(true);
    try {
      const payload = {
        amount: Number(formData.amount),
        payment_date: formData.payment_date,
        reference: formData.reference,
        note: formData.note
      };

      const res = await fetch(`/api/config/clients/${selectedClient}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Error recording payment');
      
      toast({ title: 'Success', description: 'Payment recorded successfully.' });
      setIsOpen(false);
      
      // Refresh
      setFormData({ amount: '', payment_date: new Date().toISOString().split('T')[0], reference: '', note: '' });
      await fetchClients(); // refresh client balances
      await fetchPayments(selectedClient);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Ledger</h1>
          <p className="text-muted-foreground">Track hospital accounts receivable and record incoming payments.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={selectedClient} onValueChange={(value) => setSelectedClient(value || '')}>
            <SelectTrigger className="w-[300px] bg-black/20 border-border/50">
              <SelectValue placeholder="Select a hospital ledger..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedClient ? (
        <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
            <Receipt className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">Select a hospital from the dropdown above to view their accounts receivable ledger and record payments.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-black/20 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{Number(clientData?.total_billed || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime invoices generated</p>
              </CardContent>
            </Card>
            <Card className="bg-black/20 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">৳{Number(clientData?.total_paid || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime payments received</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-950/20 border-blue-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Outstanding Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-400">৳{Number(clientData?.current_due || 0).toLocaleString()}</div>
                <p className="text-xs text-blue-400/60 mt-1">Current AR Balance</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recent payments recorded for {clientData?.name}</CardDescription>
              </div>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 bg-emerald-600 text-primary-foreground shadow hover:bg-emerald-600/90 h-9 px-4 py-2">
                  <Plus className="mr-2 h-4 w-4" /> Record New Payment
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>Add a new payment to {clientData?.name}'s ledger. This will instantly deduce their ongoing AR due.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (BDT) *</Label>
                        <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="e.g. 50000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Date *</Label>
                        <Input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference/Cheque No.</Label>
                      <Input value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="Bkash ID / Cheque..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Input value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="Optional details..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={savePayment} disabled={submitting || !formData.amount || Number(formData.amount) <= 0 || !formData.payment_date} className="bg-emerald-600 hover:bg-emerald-700">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Confirm Payment
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell>
                    </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-3 opacity-20" />
                        No payments recorded for this client yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id} className="border-border/50">
                        <TableCell className="font-medium text-emerald-400">{format(new Date(p.payment_date), 'PP')}</TableCell>
                        <TableCell>{p.reference || <span className="opacity-50 italic">None</span>}</TableCell>
                        <TableCell>{p.note || <span className="opacity-50 italic">None</span>}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-500">৳{Number(p.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
