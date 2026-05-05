"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, XCircle, Play, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from 'sonner';

interface Task {
  id: string;
  command_type: string;
  status: string;
  progress: number;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  instance: {
    name: string;
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/tasks');
      const data = await res.json();
      if (data.data) {
        setTasks(data.data);
      }
    } catch (e) {
      toast.error('Failed to load tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => fetchTasks(true), 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: 'CANCEL' | 'RETRY') => {
    setProcessing(id);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      if (res.ok) {
        toast.success(action === 'CANCEL' ? 'Cancellation requested' : 'Retry scheduled');
        fetchTasks(true);
      } else {
        throw new Error('Failed to process action');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'SENT': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Sent</Badge>;
      case 'IN_PROGRESS': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> In Progress</Badge>;
      case 'COMPLETED': return <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'FAILED': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'CANCELLED': return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Background Tasks</h1>
          <p className="text-muted-foreground">Monitor and manage remote agent instructions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTasks()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Recent Remote Tasks</CardTitle>
          <CardDescription>All instructions sent to edge agents across instances.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance / Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
              ) : tasks.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No tasks found.</TableCell></TableRow>
              ) : (
                tasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.instance.name}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{task.command_type}</div>
                      {task.error_message && (
                        <div className="text-[10px] text-red-400 mt-1 max-w-[200px] truncate" title={task.error_message}>
                          Error: {task.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${task.status === 'FAILED' ? 'bg-red-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${task.progress}%` }} 
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(task.created_at).toLocaleString()}
                      {task.retry_count > 0 && <div className="text-amber-500/70">Retry #{task.retry_count}</div>}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {(task.status === 'PENDING' || task.status === 'SENT' || task.status === 'IN_PROGRESS') && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          onClick={() => handleAction(task.id, 'CANCEL')}
                          disabled={processing === task.id}
                          title="Cancel Task"
                        >
                          {processing === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </Button>
                      )}
                      {(task.status === 'FAILED' || task.status === 'CANCELLED' || task.status === 'COMPLETED') && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
                          onClick={() => handleAction(task.id, 'RETRY')}
                          disabled={processing === task.id}
                          title="Retry/Run Again"
                        >
                          {processing === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                      )}
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
