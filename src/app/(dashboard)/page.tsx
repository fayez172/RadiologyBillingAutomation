'use client';

import { useSession } from 'next-auth/react';

function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5 hover:glow-teal transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${gradient} group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {session?.user?.name || 'User'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your billing overview
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Mappings"
          value="—"
          subtitle="Awaiting review"
          gradient="from-amber-500/20 to-orange-500/20"
          icon={
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            </svg>
          }
        />
        <StatCard
          title="Studies This Month"
          value="—"
          subtitle="Total synced"
          gradient="from-teal-500/20 to-emerald-500/20"
          icon={
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
          }
        />
        <StatCard
          title="Draft Invoices"
          value="—"
          subtitle="Ready to finalize"
          gradient="from-blue-500/20 to-indigo-500/20"
          icon={
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Total Receivable"
          value="—"
          subtitle="Across all clients"
          gradient="from-emerald-500/20 to-green-500/20"
          icon={
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="glass-card rounded-xl p-5 text-left hover:border-primary/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-3 group-hover:bg-teal-500/20 transition-colors">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Upload Studies</h3>
            <p className="text-xs text-muted-foreground mt-1">Import CSV or XLSX files</p>
          </button>

          <button className="glass-card rounded-xl p-5 text-left hover:border-primary/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Sync from MSSQL</h3>
            <p className="text-xs text-muted-foreground mt-1">Pull latest study data</p>
          </button>

          <button className="glass-card rounded-xl p-5 text-left hover:border-primary/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">New Invoice</h3>
            <p className="text-xs text-muted-foreground mt-1">Create billing invoice</p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-1">Start by syncing studies or uploading a file</p>
          </div>
        </div>
      </div>
    </div>
  );
}
