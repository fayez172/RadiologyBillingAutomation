'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { 
  Loader2, TrendingUp, Users, Activity, FileText, 
  Upload, Database, Plus, Search, CheckCircle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function QuickAction({ 
  title, 
  subtitle, 
  href, 
  onClick,
  icon: Icon, 
  colorClass,
  disabled
}: { 
  title: string; 
  subtitle: string; 
  href?: string; 
  onClick?: () => void;
  icon: any; 
  colorClass: string;
  disabled?: boolean;
}) {
  const content = (
    <div className={`glass-card rounded-xl p-5 text-left transition-all group ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30 cursor-pointer'}`}>
      <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );

  if (href && !disabled) {
    return <Link href={href}>{content}</Link>;
  }

  return <button onClick={onClick} disabled={disabled} className="w-full block appearance-none bg-transparent border-none p-0">{content}</button>;
}

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) setStats((await res.json()).data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    toast.loading('Starting manual sync...');
    try {
      const res = await fetch('/api/admin/sync', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
      });
      if (!res.ok) throw new Error('Sync failed');
      toast.success('Sync completed successfully');
      fetchStats();
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
      toast.dismiss();
    }
  };

  const handlePurge = async () => {
    if (syncing) return;
    if (!confirm("CRITICAL: This will delete ALL studies and reset the system. Are you sure?")) return;
    
    setSyncing(true);
    toast.loading('Purging system data...');
    try {
      const res = await fetch('/api/admin/sync', { method: 'DELETE' });
      if (!res.ok) throw new Error('Purge failed');
      toast.success('System purged. Starting fresh sync...');
      handleSync();
    } catch (e) {
      toast.error('Purge failed');
      setSyncing(false);
    } finally {
      toast.dismiss();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 text-center bg-destructive/5 rounded-xl border border-destructive/20 max-w-2xl mx-auto mt-12">
        <Activity className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
        <h2 className="text-lg font-bold text-destructive">Dashboard Connection Failed</h2>
        <p className="text-muted-foreground text-sm mt-2">Could not load financial metrics. Please check your database connection.</p>
      </div>
    );
  }

  const { summary, topClients, revenueTrend } = stats;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome, {session?.user?.name || 'Administrator'}
        </h1>
        <p className="text-muted-foreground mt-1 text-lg">
          TeleRadiology Billing & Revenue Cycle Overview
        </p>
      </div>

      {/* Main Stats Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-black/20 border-border/50 backdrop-blur-sm hover:glow-teal transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Total Billed</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{summary.totalBilled.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime invoiced revenue</p>
          </CardContent>
        </Card>
        
        <Card className="bg-black/20 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">Total Collected</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-400 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{summary.totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Actual cash inflow</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-950/10 border-orange-900/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-500">Uncollected (AR)</CardTitle>
            <Activity className="h-4 w-4 text-orange-500 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">৳{summary.totalDue.toLocaleString()}</div>
            <p className="text-xs text-orange-500/60">Outstanding hospital due</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-950/10 border-amber-900/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500">Radiologist Payable (AP)</CardTitle>
            <Users className="h-4 w-4 text-amber-500 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">৳{summary.radTotalDue.toLocaleString()}</div>
            <p className="text-xs text-amber-500/60">Outstanding doctor fees</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-black/20 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500">Pending Mappings</CardTitle>
            <Search className="h-4 w-4 text-amber-500 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.unmappedCount > 0 ? 'text-amber-400' : 'text-foreground'}`}>
              {summary.unmappedCount}
            </div>
            <p className="text-xs text-muted-foreground">Requires manual classification</p>
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Study Volume</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.studyCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total records synced</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Integration */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-500" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <QuickAction 
            title="Upload Files" 
            subtitle="Import volume XLSX" 
            href="/studies/upload" 
            icon={Upload} 
            colorClass="bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20"
          />
          <QuickAction 
            title="Manual Sync" 
            subtitle="Trigger remote pull" 
            onClick={handleSync}
            disabled={syncing}
            icon={syncing ? Loader2 : Database} 
            colorClass="bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20"
          />
          <QuickAction 
            title="New Invoice" 
            subtitle="Create billing" 
            href="/invoices/builder" 
            icon={Plus} 
            colorClass="bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
          />
          <QuickAction 
            title="Unmapped" 
            subtitle="Classify procedures" 
            href="/config/unmapped-procedures" 
            icon={Search} 
            colorClass="bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"
          />
          <QuickAction 
            title="Purge System" 
            subtitle="Wipe & Refresh" 
            onClick={handlePurge}
            disabled={syncing}
            icon={Trash2} 
            colorClass="bg-red-500/10 text-red-400 group-hover:bg-red-500/20"
          />
        </div>
      </section>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-black/20 border-border/50 backdrop-blur-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Invoiced Revenue Trend</CardTitle>
                <CardDescription>Billed volume over the last 6 months.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `৳${(value/1000).toFixed(0)}k`} 
                />
                <RechartsTooltip 
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-black/20 border-border/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Top Hospitals by Revenue</CardTitle>
            <CardDescription>Highest lifetime billing volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" stroke="#888" tickFormatter={(v) => `৳${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} width={100} tick={{fill: '#ccc'}} />
                  <RechartsTooltip 
                    cursor={{fill: '#333'}}
                    formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Billed']}
                    contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px' }}
                  />
                  <Bar dataKey="billed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {topClients.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground italic">
                No hospital data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
