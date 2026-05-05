'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, Check, X, CheckSquare, Square, Upload, Loader2, Download } from 'lucide-react';

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

  const [billingTypes, setBillingTypes] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Unmapped proposals state
  const [unmappedItems, setUnmappedItems] = useState<any[]>([]);
  const [unmappedLoading, setUnmappedLoading] = useState(true);
  const [unmappedSaving, setUnmappedSaving] = useState<string | null>(null);

  const fetchBillingTypes = async () => {
    try {
      const res = await fetch('/api/config/billing-types');
      const data = await res.json();
      if (res.ok) setBillingTypes(data);
    } catch (err) {
      console.error('Failed to fetch billing types', err);
    }
  };

  const fetchUnmappedData = async () => {
    setUnmappedLoading(true);
    try {
      const res = await fetch('/api/config/unmapped-procedures');
      if (res.ok) {
        setUnmappedItems((await res.json()).data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUnmappedLoading(false);
    }
  };

  const handleAssignUnmapped = async (modality: string, procedure_raw: string, typeName: string) => {
    setUnmappedSaving(`${modality}-${procedure_raw}`);
    try {
      const res = await fetch('/api/config/unmapped-procedures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedure_raw,
          type: typeName
        })
      });

      if (res.ok) {
        // Remove from unmapped list
        setUnmappedItems(prev => prev.filter(i => !(i.modality === modality && i.procedure_raw === procedure_raw)));
        // Refresh mapping rules
        fetchMappings();
      } else {
        alert("Failed to save mapping");
      }
    } catch (e) {
      alert("Connection error");
    } finally {
      setUnmappedSaving(null);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/config/mappings/import', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok) {
        setImportResult(json.data);
        fetchMappings();
      } else {
        alert(json.error?.message || 'Import failed');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportMappings = async () => {
    try {
      const res = await fetch('/api/config/mappings/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mappings_backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

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
    fetchBillingTypes();
    fetchUnmappedData();
    fetch('/api/reference/modalities').then(r => r.json()).then(data => setModalities(data.data || []));
  }, []);

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

  const TypeDropdown = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
    const isCustom = value && !billingTypes.find(t => t.name === value);
    
    return (
      <div className="flex flex-col gap-1">
        <select 
          className="w-full bg-background border px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary"
          value={isCustom ? "CUSTOM" : (value || "")}
          onChange={(e) => {
            if (e.target.value === "CUSTOM") {
              const val = prompt("Enter custom type (e.g. TypeA+TypeB or TypeA*2):", value);
              if (val) onChange(val);
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">{placeholder}</option>
          {billingTypes.map(t => (
            <option key={t.id} value={t.name}>{t.display_name}</option>
          ))}
          <option value="CUSTOM">➕ Other / Manual...</option>
        </select>
        {isCustom && <div className="text-[10px] text-blue-400 font-mono pl-1">{value}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Mappings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure rules and bulk-map unmapped procedures across all instances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-950/20 text-emerald-400 text-sm font-medium hover:bg-emerald-900/40 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/10"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Rules
          </button>
          <button
            onClick={handleExportMappings}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/50 bg-blue-950/20 text-blue-400 text-sm font-medium hover:bg-blue-900/40 transition-colors shadow-lg shadow-blue-900/10"
          >
            <Download className="w-4 h-4" />
            Download Mappings
          </button>
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
            <Plus className="w-4 h-4" /> Add Pattern
          </button>
        </div>
      </div>

      {/* NEW: UNMAPPED PROPOSALS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Unmapped unique procedures ({unmappedItems.length})
            </h2>
          </div>
          <button 
            onClick={fetchUnmappedData} 
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            {unmappedLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Refresh Proposals
          </button>
        </div>

        <div className="glass-panel overflow-hidden border-amber-500/20 bg-amber-500/5">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-amber-500/10 border-b border-amber-500/20 text-[10px] uppercase font-bold text-amber-500/70 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-2">Modality</th>
                  <th className="px-4 py-2">Original Procedure Name (Across all instances)</th>
                  <th className="px-4 py-2 text-center">Studies</th>
                  <th className="px-4 py-2 w-[250px]">Map To Billing Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {unmappedLoading && unmappedItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500/40" />
                      <p className="text-xs text-amber-500/40 mt-2 font-medium uppercase tracking-wider">Analyzing study logs...</p>
                    </td>
                  </tr>
                ) : unmappedItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <p className="text-emerald-500 font-medium">✨ All studies are currently mapped!</p>
                    </td>
                  </tr>
                ) : (
                  unmappedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-500/5 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-tighter">
                          {item.modality}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium italic text-amber-200/70 truncate max-w-sm group-hover:text-amber-200 transition-colors">
                        {item.procedure_raw}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-xs font-bold text-amber-500/60">{item.count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          disabled={unmappedSaving === `${item.modality}-${item.procedure_raw}`}
                          className="w-full bg-background/50 border border-amber-500/20 px-2 py-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500/50"
                          value=""
                          onChange={(e) => handleAssignUnmapped(item.modality, item.procedure_raw, e.target.value)}
                        >
                          <option value="">Choose Billing Type...</option>
                          {billingTypes
                            .filter(t => t.modalities && t.modalities.includes(item.modality))
                            .map(t => (
                              <option key={t.id} value={t.name}>{t.display_name}</option>
                            ))
                          }
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            Active Pattern Rules
        </h2>

      {importResult && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm">
          <p className="font-semibold text-emerald-400 mb-1">Import Complete</p>
          <p className="text-muted-foreground">
            <span className="text-foreground font-medium">{importResult.imported}</span> imported,{' '}
            <span className="text-foreground font-medium">{importResult.skipped}</span> skipped out of{' '}
            <span className="text-foreground font-medium">{importResult.total}</span> rows.
          </p>
          {importResult.errors?.length > 0 && (
            <div className="mt-2 text-xs text-red-400">
              {importResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button onClick={() => setImportResult(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">Dismiss</button>
        </div>
      )}

      <div className="glass-panel overflow-hidden border-white/5 bg-black/40 shadow-2xl">
        <div className="p-4 border-b border-white/10 flex gap-4 bg-white/5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter active rules..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-white/10 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary/50 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-background/95 border-b border-white/10 text-[10px] uppercase font-bold text-muted-foreground sticky top-0 z-10 backdrop-blur-md shadow-sm">
              <tr>
                <th className="px-4 py-3 font-bold">Active</th>
                <th className="px-4 py-3 font-bold">Modality</th>
                <th className="px-4 py-3 font-bold">Procedure Pattern</th>
                <th className="px-4 py-3 font-bold text-center">Regex</th>
                <th className="px-4 py-3 font-bold">Type (Client)</th>
                <th className="px-4 py-3 font-bold">Type (Rad)</th>
                <th className="px-4 py-3 font-bold text-center">Priority</th>
                <th className="px-4 py-3 font-bold text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isAdding && (
                <tr className="bg-primary/5">
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-2 py-2">
                    <select 
                      autoFocus 
                      className="w-full bg-background border px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary" 
                      value={newMap.modality || ''} 
                      onChange={e => setNewMap({...newMap, modality: e.target.value})}
                    >
                      <option value="">Select Modality</option>
                      {modalities.map(mod => (
                        <option key={mod.id} value={mod.id}>{mod.name} ({mod.id})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input placeholder="e.g. ^CT BRAIN.*" className="w-full bg-background border px-2 py-1 rounded text-sm font-mono" value={newMap.procedure_pattern || ''} onChange={e => setNewMap({...newMap, procedure_pattern: e.target.value})} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={newMap.is_regex || false} onChange={e => setNewMap({...newMap, is_regex: e.target.checked})} className="rounded cursor-pointer" />
                  </td>
                  <td className="px-2 py-2">
                    <TypeDropdown 
                      value={newMap.type || ''} 
                      onChange={val => setNewMap({...newMap, type: val})}
                      placeholder="Select type"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <TypeDropdown 
                      value={newMap.type_dr || ''} 
                      onChange={val => setNewMap({...newMap, type_dr: val})}
                      placeholder="Select rad type"
                    />
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
                        <select 
                          className="w-full bg-background border px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary" 
                          value={editMap.modality || ''} 
                          onChange={e => setEditMap({...editMap, modality: e.target.value})}
                        >
                          <option value="">Select Modality</option>
                          {modalities.map(mod => (
                            <option key={mod.id} value={mod.id}>{mod.name} ({mod.id})</option>
                          ))}
                        </select>
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
                        <TypeDropdown 
                          value={editMap.type || ''} 
                          onChange={val => setEditMap({...editMap, type: val})}
                          placeholder="Select type"
                        />
                        : <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                            {billingTypes.find(t => t.name === m.type)?.display_name || m.type}
                          </span>}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === m.id ? 
                        <TypeDropdown 
                          value={editMap.type_dr || ''} 
                          onChange={val => setEditMap({...editMap, type_dr: val})}
                          placeholder="Select rad type"
                        />
                        : <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs">
                            {billingTypes.find(t => t.name === m.type_dr)?.display_name || m.type_dr}
                          </span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
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
    </div>
  );
}
