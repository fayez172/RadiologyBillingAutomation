'use client';

import { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Instance {
  id: string;
  name: string;
  is_active: boolean;
}

export default function UploadClient({ instances }: { instances: Instance[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [instanceId, setInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const activeInstances = instances.filter(i => i.is_active);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!instanceId) {
      setError('Please select a database instance. This is required to maintain system integrity.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('instanceId', instanceId);

    try {
      const res = await fetch('/api/studies/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to upload and parse file.');
      }

      setResult(data.data);
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-lg font-medium">1. Select Target Instance</h2>
          <p className="text-sm text-muted-foreground">
            All uploaded studies must be bound to a source database instance to prevent key collisions and correctly map aliases.
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Database Instance</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full h-10 px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">-- Select Instance --</option>
              {activeInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={`glass-panel p-6 space-y-4 transition-opacity ${!instanceId ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-lg font-medium">2. Upload File</h2>
          <p className="text-sm text-muted-foreground">
            Supports .csv and .xlsx files. Date formats will be automatically parsed.
          </p>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center transition-colors
              ${file ? 'border-primary/50 bg-primary/5' : 'border-neutral-700 hover:border-neutral-500 hover:bg-white/5'}
            `}
          >
            <UploadCloud className={`h-10 w-10 mb-4 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
            
            {file ? (
              <div className="space-y-1">
                <p className="font-medium text-primary">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown type'}
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-red-400 hover:underline mt-2 inline-block shadow-none !bg-transparent p-0 border-0"
                  style={{boxShadow:'none'}}
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Drag and drop file here</p>
                <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="btn-primary"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleUpload}
              disabled={!file || !instanceId || loading}
              className="btn-primary w-full flex justify-center items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing ({file?.name})...
                </>
              ) : (
                'Import Data'
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md flex items-start text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="glass-panel p-6 space-y-6 self-start transform transition-all duration-500 animate-in slide-in-from-right-8 opacity-0 fade-in fill-mode-forwards">
          <div className="flex items-center text-teal-400">
            <CheckCircle2 className="w-8 h-8 mr-3" />
            <h2 className="text-xl font-medium">Import Successful</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-1">Total Rows</p>
              <p className="text-2xl font-semibold">{result.total_rows}</p>
            </div>
            <div className="p-4 rounded-md bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-1">Parsed Rows</p>
              <p className="text-2xl font-semibold">{result.parsed_rows}</p>
            </div>
            <div className="p-4 rounded-md bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-1">New Studies</p>
              <p className="text-2xl font-semibold text-green-400">{result.new_studies}</p>
            </div>
            <div className="p-4 rounded-md bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-1">Updated</p>
              <p className="text-2xl font-semibold">{result.updated_studies}</p>
            </div>
            <div className="p-4 rounded-md bg-orange-500/10 border border-orange-500/20 col-span-2">
              <p className="text-sm text-orange-400 mb-1">Possible Duplicates Flagged</p>
              <p className="text-2xl font-semibold text-orange-500">{result.duplicates_flagged}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
             <button onClick={() => window.location.href='/studies'} className="btn-secondary text-sm">
               View Studies
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
