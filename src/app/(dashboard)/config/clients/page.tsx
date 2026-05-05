'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Search, Plus, Edit2, Trash2, Loader2, Hospital, X, Mail, Phone, Tag, Globe, Receipt } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // Alias form state
  const [aliasInput, setAliasInput] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('NULL');
  const [remoteIdInput, setRemoteIdInput] = useState('');
  const [aliasList, setAliasList] = useState<any[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/clients?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/config/db-instances');
      if (res.ok) {
        const data = await res.json();
        setInstances(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    const delay = setTimeout(fetchClients, 300);
    return () => clearTimeout(delay);
  }, [search]);

  const handleOpen = (client?: any) => {
    if (client) {
      setEditingId(client.id);
      setName(client.name);
      setEmail(client.contact_email || '');
      setPhone(client.contact_phone || '');
      setAddress(client.address || '');
      setIsActive(client.is_active);
      setAliasList(client.aliases || []);
      setAliasInput('');
      setRemoteIdInput('');
      setSelectedInstanceId('NULL');
    } else {
      setEditingId(null);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setIsActive(true);
      setAliasInput('');
      setRemoteIdInput('');
      setSelectedInstanceId('NULL');
      setAliasList([]);
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        name,
        contact_email: email,
        contact_phone: phone,
        address,
        is_active: isActive,
        aliases: aliasList.map(a => ({
          alias_name: a.alias_name,
          instance_id: a.instance_id === 'NULL' ? null : a.instance_id,
          remote_id: a.remote_id ? Number(a.remote_id) : null
        }))
      };

      const url = editingId ? `/api/config/clients/${editingId}` : '/api/config/clients';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save');

      toast({ title: 'Success', description: 'Client saved successfully.' });
      setIsOpen(false);
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (client: any) => {
    try {
      const res = await fetch(`/api/config/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !client.is_active })
      });
      if (res.ok) {
        toast({ title: 'Status Updated', description: `${client.name} is now ${!client.is_active ? 'Active' : 'Inactive'}` });
        fetchClients();
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const addAlias = () => {
    if (!aliasInput.trim()) {
      toast({ title: 'Input Required', description: 'Alias name is required', variant: 'warning' } as any);
      return;
    }
    
    // Check if duplicate for this instance
    const isDup = aliasList.some(a => 
      a.alias_name.toLowerCase() === aliasInput.trim().toLowerCase() && 
      (a.instance_id || 'NULL') === selectedInstanceId
    );

    if (isDup) {
      toast({ title: 'Duplicate Alias', description: 'This alias already exists for the selected instance.', variant: 'destructive' });
      return;
    }

    const newAlias = {
      alias_name: aliasInput.trim(),
      instance_id: selectedInstanceId === 'NULL' ? null : selectedInstanceId,
      remote_id: remoteIdInput ? Number(remoteIdInput) : null,
      instance: selectedInstanceId === 'NULL' ? null : instances.find(i => i.id === selectedInstanceId)
    };

    setAliasList([...aliasList, newAlias]);
    setAliasInput('');
    setRemoteIdInput('');
  };

  const removeAlias = (idx: number) => {
    setAliasList(aliasList.filter((_, i) => i !== idx));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hospital? This will also delete all associated aliases.')) return;
    
    try {
      const res = await fetch(`/api/config/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed to delete');
      
      toast({ title: 'Success', description: 'Hospital deleted.' });
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients (Hospitals)</h1>
          <p className="text-muted-foreground">Manage client billing entities, contact details, and name aliases.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search clients..." 
            className="pl-8 bg-black/20"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button onClick={() => handleOpen()} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add Hospital
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[550px] border-border bg-popover shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update client details and instance mappings.' : 'Create a new canonical client entity.'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6 text-foreground">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g. Popular Diagnostic Centre" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="billing@client.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="+880..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)} placeholder="Client address..." />
                </div>
              </div>
              
              <div className="space-y-4 border-t border-border/50 pt-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  Mappings (Instance-Aware Aliases)
                </Label>
                
                <div className="bg-secondary/20 p-4 rounded-xl border border-border/30 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-60">Instance</Label>
                      <Select value={selectedInstanceId} onValueChange={(val: string | null) => setSelectedInstanceId(val || 'NULL')}>
                        <SelectTrigger className="h-9 bg-background/50">
                          <SelectValue placeholder="Global / All" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="NULL">Global (All Instances)</SelectItem>
                          {instances.map(cli => (
                            <SelectItem key={cli.id} value={cli.id}>{cli.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase opacity-60">Remote ID (Optional)</Label>
                      <Input 
                        value={remoteIdInput} 
                        onChange={(e) => setRemoteIdInput(e.target.value)} 
                        placeholder="Internal DB ID..."
                        className="h-9 bg-background/50"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      value={aliasInput} 
                      onChange={(e) => setAliasInput(e.target.value)} 
                      placeholder="Display Name in Remote DB..." 
                      className="h-9 bg-background/50"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                    />
                    <Button type="button" size="sm" onClick={addAlias} variant="secondary" className="h-9 shrink-0">Add Alias</Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {aliasList.map((alias, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 group animate-in fade-in slide-in-from-top-1">
                      <div className="flex flex-col gap-0.5 text-foreground">
                        <span className="text-sm font-medium flex items-center gap-2">
                          {alias.alias_name}
                          {alias.remote_id && <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 font-mono">ID: {alias.remote_id}</Badge>}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground text-ellipsis overflow-hidden whitespace-nowrap max-w-[300px]">
                          <Globe className="w-3 h-3 text-emerald-400/70" />
                          {instances.find(i => i.id === alias.instance_id)?.name || alias.instance?.name || 'Global (Fallback)'}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => removeAlias(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {aliasList.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground text-xs italic">
                      No aliases defined. Mappings will fail for this hospital.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <Label>Active Status</Label>
                  <p className="text-[10px] text-muted-foreground">Deactive hospitals won't suggesting new mappings.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <DialogFooter className="border-t border-border/50 pt-4 bg-background z-10 mt-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting || !name.trim()} className="bg-teal-600 hover:bg-teal-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <div className="relative h-[calc(100vh-320px)] overflow-auto border-b border-border/50 shadow-inner custom-scrollbar">
          <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-bold py-4 text-foreground">Hospital Name</TableHead>
              <TableHead className="font-bold text-foreground">Contact</TableHead>
              <TableHead className="font-bold text-foreground">Ledger</TableHead>
              <TableHead className="font-bold text-foreground">Aliases</TableHead>
              <TableHead className="font-bold text-foreground">Status</TableHead>
              <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  No clients found. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="border-border/50">
                  <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {client.contact_email && <span className="flex items-center"><Mail className="h-3 w-3 mr-1" /> {client.contact_email}</span>}
                      {client.contact_phone && <span className="flex items-center"><Phone className="h-3 w-3 mr-1" /> {client.contact_phone}</span>}
                      {!client.contact_email && !client.contact_phone && <span className="italic opacity-50">No contact provided</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="text-muted-foreground">৳{Number(client.total_billed).toLocaleString()} Billed</span>
                      <span className="text-emerald-500 font-medium">৳{Number(client.total_paid).toLocaleString()} Paid</span>
                      <span className="text-blue-400 font-bold">৳{Number(client.current_due).toLocaleString()} Due</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary/50 text-foreground">
                      <Tag className="h-3 w-3 mr-1" /> {client._count?.aliases || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={client.is_active} 
                      onCheckedChange={() => toggleStatus(client)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Dialog>
                        <DialogTrigger render={
                          <Button variant="ghost" size="icon" title="Adjust Balance" className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/30">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        } />
                        <BalanceAdjustDialog entity={client} type="CLIENT" onSave={fetchClients} />
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(client)} className="text-foreground">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
    </div>
  );
}

function BalanceAdjustDialog({ entity, type, onSave }: { entity: any, type: 'CLIENT' | 'RADIOLOGIST', onSave: () => void }) {
  const [billed, setBilled] = useState(entity.total_billed?.toString() || '0');
  const [paid, setPaid] = useState(entity.total_paid?.toString() || '0');
  const [due, setDue] = useState(entity.current_due?.toString() || '0');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAdjust = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const endpoint = type === 'CLIENT' ? `/api/config/clients/${entity.id}` : `/api/config/radiologists/${entity.id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_billed: Number(billed),
          total_paid: Number(paid),
          current_due: Number(due),
          reason: reason.trim()
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to adjust');
      
      toast({ title: 'Success', description: 'Balance adjusted and logged.' });
      onSave();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Adjust Balance: {entity.name}</DialogTitle>
        <DialogDescription>
          Manually override the ledger balances. This action is **AUDITED** and requires a mandatory reason.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Total Billed</Label>
            <Input type="number" value={billed} onChange={e => setBilled(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Total Paid</Label>
            <Input type="number" value={paid} onChange={e => setPaid(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Current Due</Label>
            <Input type="number" value={due} onChange={e => setDue(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reason for adjustment *</Label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Opening balance entry, Correction..." />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleAdjust} disabled={loading || !reason.trim()} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Adjustment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
