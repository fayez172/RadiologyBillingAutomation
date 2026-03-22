'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2, TrendingUp, Users, Activity, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-center text-red-500">Failed to load dashboard statistics.</div>;
  }

  const { summary, topClients, revenueTrend } = stats;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
        <p className="text-muted-foreground">Monitor revenue, accounts receivable, and client metrics across your TeleRadiology billing platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-black/20 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Total Billed</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{summary.totalBilled.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime volume generated</p>
          </CardContent>
        </Card>
        <Card className="bg-black/20 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">Total Paid (Collected)</CardTitle>
            <FileText className="h-4 w-4 text-blue-400 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{summary.totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime payments collected</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-950/20 border-orange-900/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-500">Total AR Outstanding</CardTitle>
            <Activity className="h-4 w-4 text-orange-500 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">৳{summary.totalDue.toLocaleString()}</div>
            <p className="text-xs text-orange-500/60">Current uncollected dues across all hospitals</p>
          </CardContent>
        </Card>
        <Card className="bg-black/20 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Studies</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.studyCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total mapped & deduplicated records</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-black/20 border-border/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Invoiced Revenue Trend</CardTitle>
            <CardDescription>Billed revenue over the last 6 months (excludes drafts).</CardDescription>
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
                  tickFormatter={(value) => `৳${value.toLocaleString()}`} 
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
            <CardTitle>Top 5 Clients</CardTitle>
            <CardDescription>Hospitals with the highest lifetime billing volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" stroke="#888" tickFormatter={(v) => `৳${v/1000}k`} />
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
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No client data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
