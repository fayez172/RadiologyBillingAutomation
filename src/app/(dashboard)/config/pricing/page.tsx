'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Loader2, Plus, Edit, Trash2, Globe, Building2, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PricingPage() {
  const [globalPrices, setGlobalPrices] = useState<any[]>([]);
  const [clientPrices, setClientPrices] = useState<any[]>([]);
  const [radPrices, setRadPrices] = useState<any[]>([]);
  
  const [clients, setClients] = useState<any[]>([]);
  const [radiologists, setRadiologists] = useState<any[]>([]);
  const [billingTypes, setBillingTypes] = useState<any[]>([]);
  
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedRad, setSelectedRad] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal states
  const [isGlobalOpen, setIsGlobalOpen] = useState(false);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [isRadOpen, setIsRadOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ type: '', price: '', effective_from: '', effective_to: '' });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClient) fetchClientPrices(selectedClient);
  }, [selectedClient]);

  useEffect(() => {
    if (selectedRad) fetchRadPrices(selectedRad);
  }, [selectedRad]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [gRes, cRes, rRes, bRes] = await Promise.all([
        fetch('/api/config/global-prices'),
        fetch('/api/config/clients'),
        fetch('/api/config/radiologists'),
        fetch('/api/config/billing-types')
      ]);
      if (gRes.ok) setGlobalPrices((await gRes.json()).data);
      if (cRes.ok) setClients((await cRes.json()).data);
      if (rRes.ok) setRadiologists((await rRes.json()).data);
      if (bRes.ok) setBillingTypes(await bRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientPrices = async (clientId: string) => {
    try {
      const res = await fetch(`/api/config/clients/${clientId}/prices`);
      if (res.ok) setClientPrices((await res.json()).data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRadPrices = async (radId: string) => {
    try {
      const res = await fetch(`/api/config/radiologists/${radId}/prices`);
      if (res.ok) setRadPrices((await res.json()).data);
    } catch (e) {
      console.error(e);
    }
  };

  const openModal = (category: 'global' | 'client' | 'rad', item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        type: item.type || item.type_dr,
        price: item.price.toString(),
        effective_from: item.effective_from ? new Date(item.effective_from).toISOString().split('T')[0] : '',
        effective_to: item.effective_to ? new Date(item.effective_to).toISOString().split('T')[0] : ''
      });
    } else {
      setEditingId(null);
      setFormData({ type: '', price: '', effective_from: new Date().toISOString().split('T')[0], effective_to: '' });
    }

    if (category === 'global') setIsGlobalOpen(true);
    if (category === 'client') setIsClientOpen(true);
    if (category === 'rad') setIsRadOpen(true);
  };

  const savePrice = async (category: 'global' | 'client' | 'rad') => {
    setSubmitting(true);
    try {
      let url = '';
      let method = editingId ? 'PUT' : 'POST';
      
      const payload: any = {
        price: Number(formData.price),
        effective_from: formData.effective_from,
        effective_to: formData.effective_to ? formData.effective_to : null
      };

      if (category === 'global') {
        url = editingId ? `/api/config/global-prices/${editingId}` : '/api/config/global-prices';
        payload.type = formData.type;
      } else if (category === 'client') {
        url = editingId ? `/api/config/clients/${selectedClient}/prices/${editingId}` : `/api/config/clients/${selectedClient}/prices`;
        payload.type = formData.type;
      } else if (category === 'rad') {
        url = editingId ? `/api/config/radiologists/${selectedRad}/prices/${editingId}` : `/api/config/radiologists/${selectedRad}/prices`;
        payload.type_dr = formData.type;
      }

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Error saving price');
      
      toast({ title: 'Success', description: 'Price saved successfully.' });
      
      setIsGlobalOpen(false);
      setIsClientOpen(false);
      setIsRadOpen(false);
      
      if (category === 'global') fetchInitialData();
      if (category === 'client') fetchClientPrices(selectedClient);
      if (category === 'rad') fetchRadPrices(selectedRad);

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deletePrice = async (category: 'global' | 'client' | 'rad', id: string) => {
    if (!confirm('Are you sure you want to delete this price record?')) return;
    try {
      let url = '';
      if (category === 'global') url = `/api/config/global-prices/${id}`;
      else if (category === 'client') url = `/api/config/clients/${selectedClient}/prices/${id}`;
      else if (category === 'rad') url = `/api/config/radiologists/${selectedRad}/prices/${id}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Error deleting price');
      
      toast({ title: 'Deleted', description: 'Price record removed.' });
      
      if (category === 'global') fetchInitialData();
      if (category === 'client') fetchClientPrices(selectedClient);
      if (category === 'rad') fetchRadPrices(selectedRad);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const renderTable = (category: 'global' | 'client' | 'rad', data: any[]) => (
    <div className="max-h-[500px] overflow-y-auto">
      <Table>
        <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="font-bold text-foreground">Study Type</TableHead>
            <TableHead className="font-bold text-foreground">Base Rate</TableHead>
            <TableHead className="font-bold text-foreground">Effective From</TableHead>
            <TableHead className="font-bold text-foreground">Effective To</TableHead>
            <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground opacity-60">
              No prices configured. Add one to override defaults.
            </TableCell>
          </TableRow>
        ) : (
          data.map((item) => (
            <TableRow key={item.id} className="border-border/50">
              <TableCell className="font-medium"><Badge variant="outline">{item.type || item.type_dr}</Badge></TableCell>
              <TableCell className="font-semibold text-teal-500">৳{Number(item.price).toLocaleString()}</TableCell>
              <TableCell>{format(new Date(item.effective_from), 'PP')}</TableCell>
              <TableCell>{item.effective_to ? format(new Date(item.effective_to), 'PP') : <span className="opacity-50">Ongoing</span>}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openModal(category, item)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => deletePrice(category, item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
        </TableBody>
      </Table>
    </div>
  );

  const renderModal = (category: 'global' | 'client' | 'rad', open: boolean, setOpen: (v: boolean) => void) => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Price' : 'Add Price'}</DialogTitle>
          <DialogDescription>Configure pricing for this category.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Study Type</Label>
            <Select value={formData.type} onValueChange={(val: string | null) => setFormData({ ...formData, type: val || '' })}>
              <SelectTrigger className="bg-background border-border/50">
                <SelectValue placeholder="Select a billing type..." />
              </SelectTrigger>
              <SelectContent>
                {billingTypes.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.display_name} ({t.name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price Amount (BDT)</Label>
            <Input type="number" value={formData.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })} placeholder="500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input type="date" value={formData.effective_from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, effective_from: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Effective To (Optional)</Label>
              <Input type="date" value={formData.effective_to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, effective_to: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => savePrice(category)} disabled={submitting || !formData.type || !formData.price || !formData.effective_from} className="bg-teal-600 hover:bg-teal-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pricing & Fees</h1>
        <p className="text-muted-foreground">Manage global fallback prices, client-specific rates, and radiologist fees.</p>
      </div>

      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-black/40 border border-border/50">
          <TabsTrigger value="global" className="data-[state=active]:bg-teal-600/20 data-[state=active]:text-teal-400">
            <Globe className="w-4 h-4 mr-2" /> Global
          </TabsTrigger>
          <TabsTrigger value="client" className="data-[state=active]:bg-teal-600/20 data-[state=active]:text-teal-400">
            <Building2 className="w-4 h-4 mr-2" /> Hospitals
          </TabsTrigger>
          <TabsTrigger value="rad" className="data-[state=active]:bg-teal-600/20 data-[state=active]:text-teal-400">
            <Users className="w-4 h-4 mr-2" /> Doctors
          </TabsTrigger>
        </TabsList>

        {/* GLOBAL PRICES */}
        <TabsContent value="global" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Global Fallback Prices</h2>
              <p className="text-sm text-muted-foreground">These prices apply when no client or radiologist specific price is defined.</p>
            </div>
            <Button onClick={() => openModal('global')} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Global Price
            </Button>
          </div>
          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            {loading ? <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : renderTable('global', globalPrices)}
          </Card>
          {renderModal('global', isGlobalOpen, setIsGlobalOpen)}
        </TabsContent>

        {/* CLIENT PRICES */}
        <TabsContent value="client" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Client Specific Prices</h2>
              <p className="text-sm text-muted-foreground">Override global billing rates for specific hospitals.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={selectedClient} onValueChange={(value: string | null) => setSelectedClient(value || '')}>
                <SelectTrigger className="w-[280px] bg-black/20 border-border/50">
                  <SelectValue placeholder="Select a hospital..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => openModal('client')} disabled={!selectedClient} className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add Client Price
              </Button>
            </div>
          </div>
          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            {!selectedClient ? (
              <div className="p-12 text-center text-muted-foreground">Please select a hospital from the dropdown to view or edit their custom prices.</div>
            ) : renderTable('client', clientPrices)}
          </Card>
          {renderModal('client', isClientOpen, setIsClientOpen)}
        </TabsContent>

        {/* RADIOLOGIST PRICES */}
        <TabsContent value="rad" className="mt-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Radiologist Specific Fees</h2>
              <p className="text-sm text-muted-foreground">Override generic doctor payout rates for specific radiologists.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={selectedRad} onValueChange={(value: string | null) => setSelectedRad(value || '')}>
                <SelectTrigger className="w-[280px] bg-black/20 border-border/50">
                  <SelectValue placeholder="Select a radiologist..." />
                </SelectTrigger>
                <SelectContent>
                  {radiologists.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => openModal('rad')} disabled={!selectedRad} className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add Doctor Fee
              </Button>
            </div>
          </div>
          <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
            {!selectedRad ? (
              <div className="p-12 text-center text-muted-foreground">Please select a radiologist from the dropdown to view or edit their custom fees.</div>
            ) : renderTable('rad', radPrices)}
          </Card>
          {renderModal('rad', isRadOpen, setIsRadOpen)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
