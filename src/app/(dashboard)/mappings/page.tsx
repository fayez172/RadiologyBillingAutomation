'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, PlayCircle, PlusCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Study {
  id: string;
  workflow_id: string;
  patient_name: string;
  hospital_name: string;
  modality: string | null;
  procedure_raw: string;
  report_comp_time: string;
  instance: { name: string } | null;
}

export default function MappingQueuePage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<{ id: string, name: string }[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [runningEngine, setRunningEngine] = useState(false);

  // Assignment state
  const [manualTypeId, setManualTypeId] = useState<string | null>(null);
  const [typeClient, setTypeClient] = useState('');
  const [typeRad, setTypeRad] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const url = '/api/mappings/queue' + (selectedInstance ? `?instanceId=${selectedInstance}` : '');
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) setStudies(json.data.studies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch instances for filter
    fetch('/api/instances').then(r => r.json()).then(d => {
      if (d.data) setInstances(d.data);
    });
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [selectedInstance]);

  const handleRunEngine = async () => {
    setRunningEngine(true);
    try {
      const res = await fetch('/api/mappings/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: selectedInstance || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully mapped ${data.data.mapped} out of ${data.data.total_processed} items.`);
        fetchQueue();
      } else {
        alert(data.error?.message || 'Failed to run mapping engine');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningEngine(false);
    }
  };

  const handleAssign = async (studyId: string) => {
    if (!typeClient || !typeRad) return alert('Fill both types');
    try {
      const res = await fetch('/api/mappings/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyId, type: typeClient, type_dr: typeRad })
      });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      
      // Remove from list
      setStudies(s => s.filter(x => x.id !== studyId));
      setManualTypeId(null);
      setTypeClient('');
      setTypeRad('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mapping Review Queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and map studies that the mapping engine could not automatically resolve.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link href="/config/mappings" className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
            Configure Rules
          </Link>
          <button 
            onClick={handleRunEngine}
            disabled={runningEngine}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
          >
            {runningEngine ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            {runningEngine ? 'Running...' : 'Run Mapping Engine'}
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/10 flex gap-4 bg-white/5">
          <select 
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
            className="bg-background border border-border px-3 py-1.5 rounded-md text-sm outline-none w-48"
          >
            <option value="">All Instances</option>
            {instances.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
          <div className="text-sm text-amber-400 flex items-center px-4 bg-amber-400/10 rounded-md border border-amber-500/20">
            {studies.length} studies require manual review
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source / Workflow</th>
                <th className="px-4 py-3 font-medium">Modality</th>
                <th className="px-4 py-3 font-medium">Raw Procedure</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading queue...</td></tr>
              ) : studies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-teal-500/50" />
                    All caught up! No unmapped studies found.
                  </td>
                </tr>
              ) : (
                studies.map(s => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(s.report_comp_time).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.instance?.name || 'Unknown Instance'}</div>
                      <div className="text-xs text-muted-foreground">ID: {s.workflow_id}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-400">{s.modality || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-foreground break-words max-w-sm">
                      {s.procedure_raw}
                    </td>
                    <td className="px-4 py-3">
                      {manualTypeId === s.id ? (
                        <div className="flex gap-2 items-center">
                          <input 
                            placeholder="Client Type" 
                            className="bg-background border rounded px-2 py-1 text-xs w-28"
                            value={typeClient} onChange={e => setTypeClient(e.target.value)}
                          />
                          <input 
                            placeholder="Rad Type" 
                            className="bg-background border rounded px-2 py-1 text-xs w-28"
                            value={typeRad} onChange={e => setTypeRad(e.target.value)}
                          />
                          <button onClick={() => handleAssign(s.id)} className="bg-teal-500/20 text-teal-400 p-1 rounded hover:bg-teal-500/30">
                            ✓ Assign
                          </button>
                          <button onClick={() => setManualTypeId(null)} className="bg-white/5 p-1 rounded hover:bg-white/10">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setManualTypeId(s.id); setTypeClient(''); setTypeRad(''); }}
                          className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" /> Manual Map
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
