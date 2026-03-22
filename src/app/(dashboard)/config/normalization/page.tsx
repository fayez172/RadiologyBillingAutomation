'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Search } from 'lucide-react';

interface Rule {
  id: string;
  raw_term: string;
  normalized: string;
}

export default function NormalizationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newRaw, setNewRaw] = useState('');
  const [newNormalized, setNewNormalized] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRaw, setEditRaw] = useState('');
  const [editNormalized, setEditNormalized] = useState('');

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/config/normalization');
      const json = await res.json();
      if (res.ok) setRules(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreate = async () => {
    if (!newRaw || !newNormalized) return alert('Fill both fields');
    try {
      const res = await fetch('/api/config/normalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_term: newRaw, normalized: newNormalized })
      });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      setIsAdding(false);
      setNewRaw('');
      setNewNormalized('');
      fetchRules();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editRaw || !editNormalized) return;
    try {
      const res = await fetch(`/api/config/normalization/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_term: editRaw, normalized: editNormalized })
      });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      setEditingId(null);
      fetchRules();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`/api/config/normalization/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error?.message);
      fetchRules();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = rules.filter(r => 
    r.raw_term.toLowerCase().includes(search.toLowerCase()) || 
    r.normalized.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Normalization Rules</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Map specific strings (e.g. typos, alternate spellings) to canonical procedure names before mapping.
          </p>
        </div>
        <button onClick={() => setIsAdding(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search synonym rules..."
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
                <th className="px-6 py-4 font-medium">Raw Term (Find)</th>
                <th className="px-6 py-4 font-medium">Normalized (Replace)</th>
                <th className="px-6 py-4 font-medium text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isAdding && (
                <tr className="bg-primary/5">
                  <td className="px-6 py-3">
                    <input 
                      autoFocus
                      placeholder="e.g. XRAY"
                      className="w-full bg-background border px-3 py-1.5 rounded text-sm"
                      value={newRaw} 
                      onChange={e => setNewRaw(e.target.value)} 
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input 
                      placeholder="e.g. X-RAY"
                      className="w-full bg-background border px-3 py-1.5 rounded text-sm"
                      value={newNormalized} 
                      onChange={e => setNewNormalized(e.target.value)} 
                    />
                  </td>
                  <td className="px-6 py-3 flex justify-end gap-2">
                    <button onClick={handleCreate} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsAdding(false)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 && !isAdding ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No rules found.</td></tr>
              ) : (
                filtered.map(rule => (
                  <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3">
                      {editingId === rule.id ? (
                        <input className="w-full bg-background border px-3 py-1 text-sm rounded" 
                          value={editRaw} onChange={e => setEditRaw(e.target.value)} />
                      ) : (
                        <span className="font-mono text-xs bg-white/5 border border-white/10 px-2 py-1 rounded">
                          {rule.raw_term}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {editingId === rule.id ? (
                        <input className="w-full bg-background border px-3 py-1 text-sm rounded" 
                          value={editNormalized} onChange={e => setEditNormalized(e.target.value)} />
                      ) : (
                        <span className="font-mono text-xs bg-primary/10 text-teal-400 border border-teal-500/20 px-2 py-1 rounded">
                          {rule.normalized}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {editingId === rule.id ? (
                          <>
                            <button onClick={() => handleUpdate(rule.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => {
                              setEditingId(rule.id);
                              setEditRaw(rule.raw_term);
                              setEditNormalized(rule.normalized);
                            }} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"><Trash2 className="w-4 h-4" /></button>
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
