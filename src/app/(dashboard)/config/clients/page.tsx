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
import { Building2, Search, Plus, Mail, Phone, Edit, Trash2, Tag, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
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
  const [aliases, setAliases] = useState('');
  const [isActive, setIsActive] = useState(true);
  
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
      // Aliases handling will be separate or simplified for now
    } else {
      setEditingId(null);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setAliases('');
      setIsActive(true);
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
        is_active: isActive
      };
      
      if (!editingId && aliases.trim()) {
        payload.aliases = aliases.split(',').map(a => a.trim()).filter(a => a);
      }

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client? This will delete all associated aliases and price tables.')) return;
    
    try {
      const res = await fetch(`/api/config/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      toast({ title: 'Success', description: 'Client deleted.' });
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Cannot Delete', description: err.message, variant: 'destructive' });
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
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update client details.' : 'Create a new canonical client entity.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
              
              {!editingId && (
                <div className="space-y-2">
                  <Label>Initial Aliases (comma-separated)</Label>
                  <Input value={aliases} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAliases(e.target.value)} placeholder="Popular Tangail, Popular Diagnostic..." />
                  <p className="text-xs text-muted-foreground">These raw names from the MSSQL databases will map to this client.</p>
                </div>
              )}

              {editingId && (
                <div className="flex items-center justify-between mt-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
                  <div className="space-y-0.5">
                    <Label>Active Status</Label>
                    <p className="text-xs text-muted-foreground">Inactivate to hide from reports.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>
            <DialogFooter>
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
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Client Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Ledger</TableHead>
              <TableHead>Aliases</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  No clients found. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="border-border/50">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {client.contact_email && <span className="flex items-center"><Mail className="h-3 w-3 mr-1" /> {client.contact_email}</span>}
                      {client.contact_phone && <span className="flex items-center"><Phone className="h-3 w-3 mr-1" /> {client.contact_phone}</span>}
                      {!client.contact_email && !client.contact_phone && <span className="italic opacity-50">No contact provided</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="text-green-500 font-medium">৳{Number(client.total_paid).toLocaleString()} Paid</span>
                      <span className="text-red-400 font-medium">৳{Number(client.current_due).toLocaleString()} Due</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary/50">
                      <Tag className="h-3 w-3 mr-1" /> {client._count?.aliases || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {client.is_active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(client)}>
                        <Edit className="h-4 w-4" />
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
      </Card>
    </div>
  );
}
