'use client';

import { useState, useEffect } from 'react';

interface DbInstance {
  id: string;
  name: string;
  ip: string;
  port: number;
  reporting_db: string;
  radiology_db: string;
  is_active: boolean;
  username: string;
  owner_ids: string;
  auto_sync: boolean;
  sync_time: string;
  last_synced_at: string | null;
  agent_last_seen_at: string | null;
  agent_mode: boolean;
}

export default function DbInstancesPage() {
  const [instances, setInstances] = useState<DbInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBackfillModalOpen, setIsBackfillModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{id: string, name: string} | null>(null);
  const [backfillInstance, setBackfillInstance] = useState<DbInstance | null>(null);
  const [backfillDates, setBackfillDates] = useState({ from: '', to: '' });
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    port: '1433',
    username: 'sa',
    password: '',
    reporting_db: 'RADSpaRISReportingDB',
    radiology_db: 'RADSpaRISRadiologyDB',
    owner_ids: '3',
    auto_sync: false,
    sync_time: '02:00',
    is_active: true,
  });

  const formatOwnerIds = (val: string) => {
    try {
      if (!val) return '3';
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.join(', ') : val;
    } catch {
      return val;
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/instances');
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setInstances(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (instance?: DbInstance) => {
    if (instance) {
      setEditingId(instance.id);
      setFormData({
        name: instance.name,
        ip: instance.ip,
        port: instance.port.toString(),
        username: instance.username,
        password: '', // Never populate password
        reporting_db: instance.reporting_db,
        radiology_db: instance.radiology_db,
        owner_ids: formatOwnerIds(instance.owner_ids),
        auto_sync: instance.auto_sync || false,
        sync_time: instance.sync_time || '02:00',
        is_active: instance.is_active,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        ip: '',
        port: '1433',
        username: 'sa',
        password: '',
        reporting_db: 'RADSpaRISReportingDB',
        radiology_db: 'RADSpaRISRadiologyDB',
        owner_ids: '3',
        auto_sync: false,
        sync_time: '02:00',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const url = editingId ? `/api/instances/${editingId}` : '/api/instances';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        port: parseInt(formData.port),
        // Omit password if editing and left blank
        ...(editingId && !formData.password ? {} : { password: formData.password }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || 'Failed to save instance');
      }

      await fetchInstances();
      setIsModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/instances/${deleteConfirmId.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      await fetchInstances();
      setDeleteConfirmId(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBackfillModal = (instance: DbInstance) => {
    setBackfillInstance(instance);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    setBackfillDates({
      from: lastMonth.toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    });
    setIsBackfillModalOpen(true);
  };

  const handleIssueBackfill = async () => {
    if (!backfillInstance) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/instances/${backfillInstance.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command_type: 'BACKFILL',
          payload: {
            from_date: backfillDates.from,
            to_date: backfillDates.to
          }
        })
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Failed to issue backfill');
      }
      alert('Backfill instruction sent to agent queue.');
      setIsBackfillModalOpen(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DB Instances</h1>
          <p className="text-muted-foreground mt-1">Manage remote MSSQL connections</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg hover:from-teal-400 hover:to-emerald-500 transition-all font-medium text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Instance
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {instances.filter(i => i.is_active).map((instance) => (
          <div key={instance.id} className="glass-card p-5 rounded-xl border border-border group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-2 h-full ${instance.name.includes('Test') ? 'bg-amber-500' : 'bg-teal-500'}`} />
            
            <div className="flex justify-between items-start mb-4 pr-4">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                {instance.name}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(instance)}
                  className="p-1.5 text-muted-foreground hover:text-teal-400 bg-secondary/50 rounded-md transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleOpenBackfillModal(instance)}
                  className="p-1.5 text-muted-foreground hover:text-blue-400 bg-secondary/50 rounded-md transition-colors"
                  title="Remote Backfill"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteConfirmId({ id: instance.id, name: instance.name })}
                  className="p-1.5 text-muted-foreground hover:text-destructive bg-secondary/50 rounded-md transition-colors"
                  title="Deactivate"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Address:</span>
                <span className="text-foreground tracking-wide font-mono text-xs">{instance.ip}:{instance.port}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>User:</span>
                <span className="text-foreground">{instance.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Reporting DB:</span>
                <span className="text-foreground text-xs truncate max-w-[120px]" title={instance.reporting_db}>{instance.reporting_db}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Radiology DB:</span>
                <span className="text-foreground text-xs truncate max-w-[120px]" title={instance.radiology_db}>{instance.radiology_db}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Owner IDs:</span>
                <span className="text-foreground font-mono bg-secondary/50 px-1 rounded">{formatOwnerIds(instance.owner_ids)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auto Sync:</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${instance.auto_sync ? 'bg-teal-500/10 text-teal-400' : 'bg-muted/30 text-muted-foreground'}`}>
                  {instance.auto_sync ? `Enabled at ${instance.sync_time}` : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Synced</span>
                <span className={`font-medium ${instance.last_synced_at ? 'text-teal-400' : 'text-amber-400'}`}>
                  {instance.last_synced_at 
                    ? new Date(instance.last_synced_at).toLocaleString() 
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Agent Status</span>
                <span className={`font-medium flex items-center gap-1.5 ${instance.agent_last_seen_at && (new Date().getTime() - new Date(instance.agent_last_seen_at).getTime() < 300000) ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${instance.agent_last_seen_at && (new Date().getTime() - new Date(instance.agent_last_seen_at).getTime() < 300000) ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {instance.agent_last_seen_at 
                    ? `Seen ${new Date(instance.agent_last_seen_at).toLocaleTimeString()}`
                    : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl overflow-hidden animate-slide-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
              <h2 className="text-lg font-bold text-foreground">
                {editingId ? 'Edit DB Instance' : 'Add DB Instance'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 select-text">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Instance Name</label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Uttara Branch Server"
                  />
                </div>
                
                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">IP Address</label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.ip}
                    onChange={e => setFormData({...formData, ip: e.target.value})}
                    placeholder="192.168.1.100"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    required
                    type="number"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.port}
                    onChange={e => setFormData({...formData, port: e.target.value})}
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">
                    Password {editingId && <span className="text-muted-foreground text-xs font-normal">(Leave blank to keep current)</span>}
                  </label>
                  <input
                    required={!editingId}
                    type="password"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">Reporting DB Name</label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-teal-500 outline-none text-xs"
                    value={formData.reporting_db}
                    onChange={e => setFormData({...formData, reporting_db: e.target.value})}
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">Radiology DB Name</label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-teal-500 outline-none text-xs"
                    value={formData.radiology_db}
                    onChange={e => setFormData({...formData, radiology_db: e.target.value})}
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium mb-1">Owner IDs <span className="text-muted-foreground text-xs font-normal">(Comma separated)</span></label>
                  <input
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.owner_ids}
                    onChange={e => setFormData({...formData, owner_ids: e.target.value})}
                    placeholder="e.g. 3, 4"
                  />
                </div>

                <div className="col-span-1 flex items-center mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-border text-teal-500 focus:ring-teal-500 bg-secondary"
                      checked={formData.auto_sync}
                      onChange={e => setFormData({...formData, auto_sync: e.target.checked})}
                    />
                    <span className="text-sm font-medium">Enable Auto Sync</span>
                  </label>
                </div>

                {formData.auto_sync && (
                  <div className="col-span-1">
                    <label className="block text-sm font-medium mb-1">Time <span className="text-muted-foreground text-xs font-normal">(HH:mm)</span></label>
                    <input
                      required={formData.auto_sync}
                      type="time"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      value={formData.sync_time}
                      onChange={e => setFormData({...formData, sync_time: e.target.value})}
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg hover:from-teal-400 hover:to-emerald-500 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Testing & Saving...
                    </>
                  ) : (
                    'Save Instance'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Backfill Modal */}
      {isBackfillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-slide-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
              <h2 className="text-lg font-bold text-foreground">
                Remote Backfill: {backfillInstance?.name}
              </h2>
              <button onClick={() => setIsBackfillModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Instruct the remote agent to fetch historical data for this period. 
                Existing studies in this range will be updated.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">From Date</label>
                  <input
                    type="date"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm"
                    value={backfillDates.from}
                    onChange={e => setBackfillDates({...backfillDates, from: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">To Date</label>
                  <input
                    type="date"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm"
                    value={backfillDates.to}
                    onChange={e => setBackfillDates({...backfillDates, to: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => setIsBackfillModalOpen(false)}
                  className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssueBackfill}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? 'Sending...' : 'Start Backfill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Confirm Deactivation</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to deactivate <strong>{deleteConfirmId.name}</strong>? 
                This will hide it from the dashboard and stop all sync activities.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-all text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Deactivating...' : 'Yes, Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
