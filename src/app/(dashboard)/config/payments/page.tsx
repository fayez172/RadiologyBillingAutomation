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
  const [type, setType] = useState<'HOSPITAL' | 'RADIOLOGIST'>('HOSPITAL');
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [entityData, setEntityData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [formData, setFormData] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], reference: '', note: '' });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchEntities();
    setSelectedId(''); // Reset selection when type changes
  }, [type]);

  useEffect(() => {
    if (selectedId) {
      const entity = entities.find(e => e.id === selectedId);
      setEntityData(entity);
      fetchPayments(selectedId);
    } else {
      setEntityData(null);
      setPayments([]);
    }
  }, [selectedId, entities]);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'HOSPITAL' ? '/api/config/clients' : '/api/config/radiologists';
      const res = await fetch(endpoint);
      if (res.ok) setEntities((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async (id: string) => {
    setLoading(true);
    try {
      const endpoint = type === 'HOSPITAL' 
        ? `/api/config/clients/${id}/payments` 
        : `/api/config/radiologists/${id}/payments`;
      const res = await fetch(endpoint);
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

      const endpoint = type === 'HOSPITAL'
        ? `/api/config/clients/${selectedId}/payments`
        : `/api/config/radiologists/${selectedId}/payments`;

      const res = await fetch(endpoint, {
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
      await fetchEntities(); // refresh balances
      await fetchPayments(selectedId);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isHospital = type === 'HOSPITAL';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Ledger</h1>
          <p className="text-muted-foreground">
            {isHospital 
              ? 'Track hospital accounts receivable and record incoming payments.' 
              : 'Track radiologist accounts payable and record outgoing payments.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-black/40 p-1 rounded-lg border border-border/50">
            <Button 
              variant={isHospital ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setType('HOSPITAL')}
              className={isHospital ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : ''}
            >
              Hospitals
            </Button>
            <Button 
              variant={!isHospital ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setType('RADIOLOGIST')}
              className={!isHospital ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30' : ''}
            >
              Radiologists
            </Button>
          </div>

          <Select value={selectedId} onValueChange={(value) => setSelectedId(value || '')}>
            <SelectTrigger className="w-[300px] bg-black/20 border-border/50">
              <SelectValue placeholder={`Select a ${isHospital ? 'hospital' : 'radiologist'}...`} />
            </SelectTrigger>
            <SelectContent>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedId ? (
        <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
            <Receipt className={`w-12 h-12 mb-4 opacity-20 ${isHospital ? 'text-blue-400' : 'text-amber-400'}`} />
            <p className="text-lg max-w-md">
              Select a {isHospital ? 'hospital' : 'radiologist'} from the dropdown above to view their {isHospital ? 'accounts receivable' : 'accounts payable'} ledger and record payments.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-black/20 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total {isHospital ? 'Billed' : 'Payable'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{Number(entityData?.total_billed || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isHospital ? 'Lifetime hospital invoices' : 'Lifetime radiologist fees'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-black/20 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isHospital ? 'text-emerald-500' : 'text-blue-500'}`}>
                  ৳{Number(entityData?.total_paid || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isHospital ? 'Lifetime payments received' : 'Lifetime payments made'}
                </p>
              </CardContent>
            </Card>
            <Card className={isHospital ? "bg-blue-950/20 border-blue-900/50" : "bg-amber-950/20 border-amber-900/50"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current {isHospital ? 'Outstanding Due' : 'Unpaid Balance'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isHospital ? 'text-blue-400' : 'text-amber-400'}`}>
                  ৳{Number(entityData?.current_due || 0).toLocaleString()}
                </div>
                <p className={`text-xs mt-1 ${isHospital ? 'text-blue-400/60' : 'text-amber-400/60'}`}>
                  {isHospital ? 'Current AR Balance' : 'Current AP Balance'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recent payments recorded for {entityData?.name}</CardDescription>
              </div>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 text-primary-foreground shadow h-9 px-4 py-2 ${isHospital ? 'bg-emerald-600 hover:bg-emerald-600/90' : 'bg-blue-600 hover:bg-blue-600/90'}`}>
                  <Plus className="mr-2 h-4 w-4" /> Record {isHospital ? 'New Payment' : 'Fee Payment'}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                      Add a new payment to {entityData?.name}'s ledger. This will instantly deduce their ongoing {isHospital ? 'AR due' : 'AP balance'}.
                    </DialogDescription>
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
                    <Button onClick={savePayment} disabled={submitting || !formData.amount || Number(formData.amount) <= 0 || !formData.payment_date} className={isHospital ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}>
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
                        No payments recorded for this {isHospital ? 'client' : 'radiologist'} yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p) => (
                      <TableRow key={p.id} className="border-border/50">
                        <TableCell className={`font-medium ${isHospital ? 'text-emerald-400' : 'text-blue-400'}`}>{format(new Date(p.payment_date), 'PP')}</TableCell>
                        <TableCell>{p.reference || <span className="opacity-50 italic">None</span>}</TableCell>
                        <TableCell>{p.note || <span className="opacity-50 italic">None</span>}</TableCell>
                        <TableCell className={`text-right font-bold ${isHospital ? 'text-emerald-500' : 'text-blue-500'}`}>৳{Number(p.amount).toLocaleString()}</TableCell>
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
