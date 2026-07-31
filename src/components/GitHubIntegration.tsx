import React, { useState } from 'react';
import { Github, Folder, File, ChevronRight, Download, Search } from 'lucide-react';

export function GitHubIntegration({ onLoadFile }: { onLoadFile: (content: string, name: string) => void }) {
  const [token, setToken] = useState('');
  const [repoPath, setRepoPath] = useState('facebook/react'); // owner/repo
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState('');

  const fetchRepo = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `token ${token}`;
      
      const res = await fetch(`https://api.github.com/repos/${repoPath}/contents/${currentPath}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch repository. Check repo name and token.');
      
      const data = await res.json();
      setTree(Array.isArray(data) ? data : [data]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: any) => {
    if (item.type === 'dir') {
      setCurrentPath(item.path);
      setTimeout(fetchRepo, 0);
    } else if (item.type === 'file') {
      setLoading(true);
      try {
        const headers: any = {};
        if (token) headers['Authorization'] = `token ${token}`;
        
        const res = await fetch(item.download_url, { headers });
        const text = await res.text();
        onLoadFile(text, item.name);
      } catch (e: any) {
        alert('Failed to load file content.');
      } finally {
        setLoading(false);
      }
    }
  };

  const goBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
    setTimeout(fetchRepo, 0);
  };

  return (
    <div className="bg-[#020617] border border-[#334155] p-4 rounded-xl flex flex-col gap-4 h-full shadow-2xl animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 border-b border-[#334155] pb-2">
        <Github className="w-5 h-5 text-white" />
        <h3 className="font-bold text-white text-sm uppercase tracking-wider">GitHub Explorer</h3>
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Owner/Repo (e.g. facebook/react)"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          className="flex-1 bg-[#0F172A] border border-[#334155] rounded px-3 py-1.5 text-xs font-mono text-white focus:border-[#34D399] outline-none"
        />
        <input
          type="password"
          placeholder="PAT (Optional for private)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-48 bg-[#0F172A] border border-[#334155] rounded px-3 py-1.5 text-xs font-mono text-white focus:border-[#34D399] outline-none"
        />
        <button onClick={fetchRepo} className="bg-[#34D399] text-[#064E3B] px-3 py-1.5 rounded text-xs font-bold hover:bg-[#10B981] flex items-center gap-2">
          <Search className="w-3.5 h-3.5" /> EXPLORE
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0F172A] border border-[#334155] rounded-lg p-2 font-mono text-xs">
        {loading ? (
          <div className="text-[#94A3B8] p-4 animate-pulse">Loading...</div>
        ) : tree.length > 0 ? (
          <div className="flex flex-col gap-1">
            {currentPath && (
              <button onClick={goBack} className="flex items-center gap-2 text-[#94A3B8] hover:text-white p-2 hover:bg-[#1E293B] rounded text-left">
                <ChevronRight className="w-4 h-4 rotate-180" /> .. (Go back)
              </button>
            )}
            {tree.map(item => (
              <button
                key={item.sha}
                onClick={() => handleItemClick(item)}
                className="flex items-center justify-between text-[#94A3B8] hover:text-white p-2 hover:bg-[#1E293B] rounded text-left group"
              >
                <div className="flex items-center gap-2">
                  {item.type === 'dir' ? <Folder className="w-4 h-4 text-[#60A5FA]" /> : <File className="w-4 h-4 text-[#94A3B8]" />}
                  <span>{item.name}</span>
                </div>
                {item.type === 'file' && (
                  <Download className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#34D399]" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[#64748B] p-4 text-center">Enter a repository to browse its files.</div>
        )}
      </div>
    </div>
  );
}
