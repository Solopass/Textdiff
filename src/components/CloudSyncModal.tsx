import React, { useState } from 'react';
import { X, Github, Database, DownloadCloud, UploadCloud, FileText } from 'lucide-react';

interface Props {
  onClose: () => void;
  origText: string;
  setOrigText: (t: string) => void;
  modText: string;
  setModText: (t: string) => void;
  baseText: string;
  setBaseText: (t: string) => void;
  onDiff?: (orig: string, mod: string) => void;
}

export const CloudSyncModal: React.FC<Props> = ({
  onClose,
  origText,
  setOrigText,
  modText,
  setModText,
  baseText,
  setBaseText,
  onDiff,
}) => {
  const [provider, setProvider] = useState<'github' | 'dropbox' | 'drive'>('github');
  const [token, setToken] = useState(() => localStorage.getItem('tds_github_token') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gistId, setGistId] = useState('');

  const handleExportGist = async () => {
    localStorage.setItem('tds_github_token', token);
    if (!token) {
      setError('Please enter a GitHub Personal Access Token');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'TextDiff Studio Session',
          public: false,
          files: {
            'original.txt': { content: origText || ' ' },
            'modified.txt': { content: modText || ' ' },
            'base.txt': { content: baseText || ' ' }
          }
        })
      });
      if (!response.ok) throw new Error('Failed to create Gist. Check your token.');
      const data = await response.json();
      setSuccess(`Gist created successfully! ID: ${data.id}`);
      setGistId(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportGist = async () => {
    if (token) localStorage.setItem('tds_github_token', token);
    if (!gistId) {
      setError('Please enter a Gist ID to import');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const headers: any = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `token ${token}`;

      const response = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch Gist. It might be private and require a token.');
      const data = await response.json();
      
      const newOrig = data.files['original.txt'] ? data.files['original.txt'].content : origText;
      const newMod = data.files['modified.txt'] ? data.files['modified.txt'].content : modText;
      if (data.files['original.txt']) setOrigText(newOrig);
      if (data.files['modified.txt']) setModText(newMod);
      if (data.files['base.txt']) setBaseText(data.files['base.txt'].content);

      if (onDiff && (data.files['original.txt'] || data.files['modified.txt'])) {
        onDiff(newOrig, newMod);
      }
      
      setSuccess('Gist imported successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cloud sync"
    >
      <div className="bg-[#0F172A] border border-[#334155] w-full max-w-lg rounded shadow-2xl flex flex-col overflow-hidden">
        
        <div className="bg-[#1E293B] px-4 py-3 flex justify-between items-center border-b border-[#334155]">
          <h2 className="text-white font-bold tracking-widest text-sm flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-[#34D399]" /> CLOUD SYNC
          </h2>
          <button
            onClick={onClose}
            aria-label="Close cloud sync dialog"
            title="Close"
            className="text-[#94A3B8] hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Provider Selection */}
          <div className="flex bg-[#1E293B] p-1 rounded">
            <button 
              onClick={() => setProvider('github')}
              className={`flex-1 py-1.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 rounded transition-colors ${provider === 'github' ? 'bg-[#334155] text-white' : 'text-[#64748B] hover:text-[#94A3B8]'}`}
            >
              <Github className="w-3.5 h-3.5" /> GITHUB GISTS
            </button>
            <button 
              className={`flex-1 py-1.5 text-xs font-bold tracking-wider flex items-center justify-center gap-2 rounded transition-colors opacity-50 cursor-not-allowed text-[#64748B]`}
              title="Coming Soon"
            >
              <Database className="w-3.5 h-3.5" /> DROPBOX (SOON)
            </button>
          </div>

          {provider === 'github' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Export your current diff session as a GitHub Gist, or import an existing Gist. 
                <br />For private Gists, provide a Personal Access Token with the <code>gist</code> scope.
              </p>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">GitHub Access Token (Optional for public imports)</label>
                <input 
                  type="password" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="bg-[#020617] border border-[#334155] rounded px-3 py-2 text-sm text-[#E2E8F0] focus:border-[#34D399] outline-none font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Gist ID (For Import)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={gistId}
                    onChange={(e) => setGistId(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e..."
                    className="flex-1 bg-[#020617] border border-[#334155] rounded px-3 py-2 text-sm text-[#E2E8F0] focus:border-[#34D399] outline-none font-mono"
                  />
                  <button 
                    onClick={handleImportGist}
                    disabled={loading || !gistId}
                    className="px-4 py-2 bg-[#1E293B] border border-[#334155] rounded text-white text-xs font-bold hover:bg-[#334155] disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" /> IMPORT
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#334155] flex justify-between items-center">
                <span className="text-[10px] text-[#64748B] uppercase tracking-wider">Create new private gist</span>
                <button 
                  onClick={handleExportGist}
                  disabled={loading || !token}
                  className="px-4 py-2 bg-[#064E3B] border border-[#065F46] rounded text-[#34D399] text-xs font-bold hover:bg-[#065F46] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> EXPORT TO GIST
                </button>
              </div>
            </div>
          )}

          {error && <div className="text-xs text-[#EF4444] bg-[#7F1D1D]/20 border border-[#7F1D1D] p-3 rounded">{error}</div>}
          {success && <div className="text-xs text-[#34D399] bg-[#064E3B]/20 border border-[#064E3B] p-3 rounded">{success}</div>}

        </div>
      </div>
    </div>
  );
};
