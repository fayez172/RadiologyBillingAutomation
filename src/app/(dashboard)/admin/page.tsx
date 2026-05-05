"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Loader2, Trash2, Edit, Key, PlayCircle } from "lucide-react";
import { formatBDT } from '@/lib/date-utils';
import { toast } from 'sonner';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
          <p className="text-muted-foreground">Manage users, roles, and view system status.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="system">System Status</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="system" className="mt-6">
          <SystemStatus />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'VIEWER' });
  const [editUser, setEditUser] = useState({ id: '', name: '', role: 'VIEWER', is_active: true });
  const [passwordForm, setPasswordForm] = useState({ id: '', newPassword: '' });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create user');
      }
      toast.success('User created successfully');
      setIsAddOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'VIEWER' });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      toast.success('User deleted');
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEditUser = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUser)
      });
      if (!res.ok) throw new Error('Failed to update user');
      toast.success('User updated successfully');
      setIsEditOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleChangePassword = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/users/${passwordForm.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordForm.newPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to change password');
      }
      toast.success('Password changed successfully');
      setIsPasswordOpen(false);
      setPasswordForm({ id: '', newPassword: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> User Accounts
          </CardTitle>
          <CardDescription>Manage application access and roles.</CardDescription>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20">
              <Plus className="h-4 w-4 mr-2" /> Add User
            </Button>
          } />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a new user to the system. They will be able to log in immediately.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(r: string | null) => setNewUser({ ...newUser, role: r || 'VIEWER' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsAddOpen(false)} variant="ghost" disabled={processing}>Cancel</Button>
              <Button onClick={handleAddUser} disabled={processing || !newUser.name || !newUser.email || !newUser.password}>
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User Profile</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editUser.role} onValueChange={(r: string | null) => setEditUser({ ...editUser, role: r || 'VIEWER' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  checked={editUser.is_active} 
                  onChange={e => setEditUser({...editUser, is_active: e.target.checked})}
                  className="rounded border-border bg-secondary"
                  id="isActive"
                />
                <Label htmlFor="isActive">Account is active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsEditOpen(false)} variant="ghost" disabled={processing}>Cancel</Button>
              <Button onClick={handleEditUser} disabled={processing || !editUser.name}>
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Enter a new password for this user.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="Minimum 6 characters" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsPasswordOpen(false)} variant="ghost" disabled={processing}>Cancel</Button>
              <Button onClick={handleChangePassword} disabled={processing || passwordForm.newPassword.length < 6}>
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Update Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto opacity-50" /></TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className={u.role === 'ADMIN' ? 'bg-primary/20 text-primary border-primary/20' : ''}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? 
                      <Badge variant="outline" className="border-emerald-500/20 text-emerald-500 bg-emerald-500/10">Active</Badge> : 
                      <Badge variant="outline" className="border-red-500/20 text-red-500 bg-red-500/10">Inactive</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatBDT(u.created_at, 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => {
                      setPasswordForm({ id: u.id, newPassword: '' });
                      setIsPasswordOpen(true);
                    }} title="Change Password">
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => {
                      setEditUser({ id: u.id, name: u.name, role: u.role, is_active: u.is_active });
                      setIsEditOpen(true);
                    }} title="Edit User">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(u.id, u.name)} title="Delete User">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SystemStatus() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-stats');
      const data = await res.json();
      if (data.data) setStats(data.data);
    } catch (e) {
      toast.error('Failed to load system stats');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sync completed successfully.`);
        fetchStats();
      } else {
        throw new Error(data.error?.message || 'Sync failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm("CRITICAL: This will delete ALL studies, invoice items, and reset sync markers. This cannot be undone. Are you sure?")) return;
    if (!confirm("Final Confirmation: Purge all data for a fresh start?")) return;

    setSyncing(true);
    try {
      const res = await fetch('/api/admin/sync', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success("System data has been reset. Starting fresh sync...");
        handleManualSync();
      } else {
        throw new Error(data.error?.message || 'Reset failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardDescription>Reference Modalities</CardDescription>
            <CardTitle className="text-2xl">{stats?.counts?.modalities || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardDescription>Mapped Procedures</CardDescription>
            <CardTitle className="text-2xl">{stats?.counts?.procedures || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardDescription>Radiologists</CardDescription>
            <CardTitle className="text-2xl">{stats?.counts?.radiologists || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardDescription>Total Studies</CardDescription>
            <CardTitle className="text-2xl">{stats?.counts?.studies || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Instance Sync Health</CardTitle>
            <CardDescription>Real-time status of remote database connections.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleResetData} 
              disabled={syncing}
              className="border-red-500/20 hover:bg-red-500/10 text-red-400"
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Reset & Restart Sync
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleManualSync} 
              disabled={syncing}
              className="border-primary/20 hover:bg-primary/10"
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Trigger Manual Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Synced At</TableHead>
                <TableHead className="text-right">Health Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.instances?.map((inst: any) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      inst.status === 'HEALTHY' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10' :
                      inst.status === 'PENDING' ? 'border-amber-500/20 text-amber-500 bg-amber-500/10' :
                      'border-red-500/20 text-red-500 bg-red-500/10'
                    }>
                      {inst.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inst.last_synced_at ? formatBDT(inst.last_synced_at, 'MMM dd, HH:mm') : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="w-24 bg-white/5 rounded-full h-1.5 ml-auto overflow-hidden">
                      <div className={`h-full ${inst.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500/50'}`} style={{ width: inst.status === 'HEALTHY' ? '100%' : '30%' }}></div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
