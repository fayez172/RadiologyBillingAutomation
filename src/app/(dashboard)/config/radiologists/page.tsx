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
import { Users, Search, Plus, Mail, Edit, Trash2, Tag, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function RadiologistsPage() {
  const [radiologists, setRadiologists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [aliases, setAliases] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchRadiologists = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config/radiologists?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setRadiologists(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchRadiologists, 300);
    return () => clearTimeout(delay);
  }, [search]);

  const handleOpen = (radiologist?: any) => {
    if (radiologist) {
      setEditingId(radiologist.id);
      setName(radiologist.name);
      setEmail(radiologist.email || '');
      setIsActive(radiologist.is_active);
    } else {
      setEditingId(null);
      setName('');
      setEmail('');
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
        email,
        is_active: isActive
      };
      
      if (!editingId && aliases.trim()) {
        payload.aliases = aliases.split(',').map(a => a.trim()).filter(a => a);
      }

      const url = editingId ? `/api/config/radiologists/${editingId}` : '/api/config/radiologists';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed to save');

      toast({ title: 'Success', description: 'Radiologist saved successfully.' });
      setIsOpen(false);
      fetchRadiologists();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this radiologist? This will delete all associated aliases and price tables.')) return;
    
    try {
      const res = await fetch(`/api/config/radiologists/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed to delete');
      
      toast({ title: 'Success', description: 'Radiologist deleted.' });
      fetchRadiologists();
    } catch (err: any) {
      toast({ title: 'Cannot Delete', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Radiologists</h1>
          <p className="text-muted-foreground">Manage reporting doctors, their contact details, and name aliases.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search radiologists..." 
            className="pl-8 bg-black/20"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button onClick={() => handleOpen()} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="mr-2 h-4 w-4" /> Add Radiologist
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Radiologist' : 'Add New Radiologist'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update radiologist details.' : 'Create a new canonical radiologist entity.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Doctor Name *</Label>
                <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g. Dr. John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="doctor@example.com" />
              </div>
              
              {!editingId && (
                <div className="space-y-2">
                  <Label>Initial Aliases (comma-separated)</Label>
                  <Input value={aliases} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAliases(e.target.value)} placeholder="John Doe, J. Doe..." />
                  <p className="text-xs text-muted-foreground">These raw names from the MSSQL databases will map to this doctor.</p>
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
                Save Doctor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Doctor Name</TableHead>
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
                  Loading radiologists...
                </TableCell>
              </TableRow>
            ) : radiologists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  No doctors found. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              radiologists.map((rad) => (
                <TableRow key={rad.id} className="border-border/50">
                  <TableCell className="font-medium">{rad.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {rad.email ? <span className="flex items-center"><Mail className="h-3 w-3 mr-1" /> {rad.email}</span> : <span className="italic opacity-50">No email</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span className="text-green-500 font-medium">৳{Number(rad.total_paid).toLocaleString()} Paid</span>
                      <span className="text-red-400 font-medium">৳{Number(rad.current_due).toLocaleString()} Due</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary/50">
                      <Tag className="h-3 w-3 mr-1" /> {rad._count?.aliases || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rad.is_active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(rad)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => handleDelete(rad.id)}>
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
