'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, Check, X, CheckSquare, Square } from 'lucide-react';

interface Mapping {
  id: string;
  modality: string;
  procedure_pattern: string;
  is_regex: boolean;
  type: string;
  type_dr: string;
  priority: number;
  is_active: boolean;
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newMap, setNewMap] = useState<Partial<Mapping>>({ is_regex: false, priority: 0, is_active: true });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<Partial<Mapping>>({});

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/config/mappings' + (search ? `?search=${encodeURIComponent(search)}` : ''));
      const json = await res.json();
      if (res.ok) setMappings(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchMappings(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    if (!newMap.modality || !newMap.procedure_pattern || !newMap.type || !newMap.type_dr) {
      return alert('Fill all required fields');
    }
    try {
      const res = await fetch('/api/config/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMap)
      });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      setIsAdding(false);
      setNewMap({ is_regex: false, priority: 0, is_active: true });
      fetchMappings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/config/mappings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMap)
      });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      setEditingId(null);
      fetchMappings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`/api/config/mappings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      fetchMappings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleActive = async (m: Mapping) => {
    try {
      await fetch(`/api/config/mappings/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !m.is_active })
      });
      fetchMappings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Master Mappings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Map normalized Procedure & Modality strings to internal billing Types. Evaluated top-to-bottom.
          </p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Mapping
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/10 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search mappings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Modality</th>
                <th className="px-4 py-3 font-medium">Procedure Pattern</th>
                <th className="px-4 py-3 font-medium text-center">Is Regex</th>
                <th className="px-4 py-3 font-medium">Type (Client)</th>
                <th className="px-4 py-3 font-medium">Type (Radiologist)</th>
                <th className="px-4 py-3 font-medium w-20">Priority</th>
                <th className="px-4 py-3 font-medium text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isAdding && (
                <tr className="bg-primary/5">
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-2 py-2">
                    <input autoFocus placeholder="e.g. CT" className="w-full bg-background border px-2 py-1 rounded text-sm" value={newMap.modality || ''} onChange={e => setNewMap({...newMap, modality: e.target.value})} />
                  </td>
                  <td className="px-2 py-2">
                    <input placeholder="e.g. ^CT BRAIN.*" className="w-full bg-background border px-2 py-1 rounded text-sm font-mono" value={newMap.procedure_pattern || ''} onChange={e => setNewMap({...newMap, procedure_pattern: e.target.value})} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={newMap.is_regex || false} onChange={e => setNewMap({...newMap, is_regex: e.target.checked})} className="rounded cursor-pointer" />
                  </td>
                  <td className="px-2 py-2">
                    <input placeholder="Billing Type" className="w-full bg-background border px-2 py-1 rounded text-sm" value={newMap.type || ''} onChange={e => setNewMap({...newMap, type: e.target.value})} />
                  </td>
                  <td className="px-2 py-2">
                    <input placeholder="Rad Type" className="w-full bg-background border px-2 py-1 rounded text-sm" value={newMap.type_dr || ''} onChange={e => setNewMap({...newMap, type_dr: e.target.value})} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" className="w-full bg-background border px-2 py-1 rounded text-sm" value={newMap.priority || 0} onChange={e => setNewMap({...newMap, priority: parseInt(e.target.value)})} />
                  </td>
                  <td className="px-4 py-3 flex justify-end gap-1">
                    <button onClick={handleCreate} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setIsAdding(false)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"><X className="w-4 h-4" /></button>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : mappings.length === 0 && !isAdding ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No mappings found.</td></tr>
              ) : (
                mappings.map(m => (
                  <tr key={m.id} className={`hover:bg-white/5 transition-colors ${!m.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(m)} className="text-muted-foreground hover:text-primary">
                        {m.is_active ? <CheckSquare className="w-4 h-4 text-teal-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {editingId === m.id ? 
                        <input className="w-full bg-background border px-2 py-1 rounded text-sm" value={editMap.modality || ''} onChange={e => setEditMap({...editMap, modality: e.target.value})} /> 
                        : m.modality}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {editingId === m.id ? 
                        <input className="w-full bg-background border px-2 py-1 rounded text-sm font-mono" value={editMap.procedure_pattern || ''} onChange={e => setEditMap({...editMap, procedure_pattern: e.target.value})} /> 
                        : m.procedure_pattern}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === m.id ? 
                        <input type="checkbox" checked={editMap.is_regex || false} onChange={e => setEditMap({...editMap, is_regex: e.target.checked})} className="rounded cursor-pointer" /> 
                        : (m.is_regex ? 'Yes' : 'No')}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === m.id ? 
                        <input className="w-full bg-background border px-2 py-1 rounded text-sm" value={editMap.type || ''} onChange={e => setEditMap({...editMap, type: e.target.value})} /> 
                        : <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{m.type}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === m.id ? 
                        <input className="w-full bg-background border px-2 py-1 rounded text-sm" value={editMap.type_dr || ''} onChange={e => setEditMap({...editMap, type_dr: e.target.value})} /> 
                        : <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs">{m.type_dr}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === m.id ? 
                        <input type="number" className="w-full bg-background border px-2 py-1 rounded text-sm" value={editMap.priority || 0} onChange={e => setEditMap({...editMap, priority: parseInt(e.target.value)})} /> 
                        : m.priority}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {editingId === m.id ? (
                          <>
                            <button onClick={() => handleUpdate(m.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => {
                              setEditingId(m.id);
                              setEditMap(m);
                            }} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(m.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
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
