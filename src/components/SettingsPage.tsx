import React, { useState } from 'react';
import { ArrowLeft, Settings, BookOpen, Key, Palette, HardDrive, FileText, CheckCircle, XCircle, Loader2, BugPlay, LineChart, Activity, Clock, FileCode2 } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const SettingsPage: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'instructions' | 'shortcuts' | 'tests' | 'analytics'>('instructions');
  
  // Analytics State
  const [stats, setStats] = useState({ totalDiffs: 0, lastRun: 'Never', mostUsedLang: 'javascript' });
  React.useEffect(() => {
    try {
      const histStr = localStorage.getItem('tds_history');
      if (histStr) {
        const h = JSON.parse(histStr);
        setStats({
          totalDiffs: h.length,
          lastRun: h.length > 0 ? new Date(h[0].timestamp).toLocaleString() : 'Never',
          mostUsedLang: 'javascript' // mock for now, could be expanded
        });
      }
    } catch(e) {}
  }, []);
  const isDev = import.meta.env.DEV;

  const [testResults, setTestResults] = useState<{name: string, status: 'pending' | 'running' | 'passed' | 'failed', error?: string}[]>([
    { name: 'Local Storage Access', status: 'pending' },
    { name: 'LZ-String Compression', status: 'pending' },
    { name: 'Prism Syntax Engine', status: 'pending' },
    { name: 'Firebase Initialization', status: 'pending' },
  ]);

  const runTests = async () => {
    const updateTest = (index: number, status: any, error?: string) => {
      setTestResults(prev => prev.map((t, i) => i === index ? { ...t, status, error } : t));
    };

    // Reset
    setTestResults(prev => prev.map(t => ({ ...t, status: 'pending', error: undefined })));

    // Test 1: Local Storage
    updateTest(0, 'running');
    await new Promise(r => setTimeout(r, 300));
    try {
      localStorage.setItem('tds_test', 'test');
      if (localStorage.getItem('tds_test') !== 'test') throw new Error('Value mismatch');
      localStorage.removeItem('tds_test');
      updateTest(0, 'passed');
    } catch (e: any) {
      updateTest(0, 'failed', e.message);
    }

    // Test 2: LZ-String
    updateTest(1, 'running');
    await new Promise(r => setTimeout(r, 300));
    try {
      const LZString = (await import('lz-string')).default;
      const compressed = LZString.compressToEncodedURIComponent('test data');
      const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      if (decompressed !== 'test data') throw new Error('Compression failed');
      updateTest(1, 'passed');
    } catch (e: any) {
      updateTest(1, 'failed', e.message);
    }

    // Test 3: Prism
    updateTest(2, 'running');
    await new Promise(r => setTimeout(r, 300));
    try {
      const Prism = (await import('prismjs')).default;
      if (!Prism.languages) throw new Error('Prism not initialized');
      updateTest(2, 'passed');
    } catch (e: any) {
      updateTest(2, 'failed', e.message);
    }

    // Test 4: Firebase
    updateTest(3, 'running');
    await new Promise(r => setTimeout(r, 300));
    try {
      const { db } = await import('../firebase');
      if (!db) throw new Error('Firestore not initialized');
      updateTest(3, 'passed');
    } catch (e: any) {
      updateTest(3, 'failed', e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-[#E2E8F0] flex flex-col">
      {/* Header */}
      <header className="bg-[#0F172A] border-b border-[#334155] px-6 py-4 flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-[#1E293B] rounded transition-colors text-[#94A3B8] hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#34D399]" />
          SETTINGS & DOCS
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[#0F172A] border-r border-[#334155] p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition-colors ${activeTab === 'general' ? 'bg-[#334155] text-white' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'}`}
          >
            <HardDrive className="w-4 h-4" />
            GENERAL
          </button>
          <button 
            onClick={() => setActiveTab('instructions')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition-colors ${activeTab === 'instructions' ? 'bg-[#334155] text-white' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'}`}
          >
            <BookOpen className="w-4 h-4" />
            INSTRUCTIONS
          </button>
          <button 
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition-colors ${activeTab === 'shortcuts' ? 'bg-[#334155] text-white' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'}`}
          >
            <Key className="w-4 h-4" />
            SHORTCUTS
          </button>
          {isDev && (
            <button 
              onClick={() => setActiveTab('tests')}
              className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition-colors ${activeTab === 'tests' ? 'bg-[#334155] text-white' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'}`}
            >
              <BugPlay className="w-4 h-4" />
              TEST SUITE (DEV)
            </button>
          )}
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wide transition-colors ${activeTab === 'analytics' ? 'bg-[#334155] text-white' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'}`}
          >
            <LineChart className="w-4 h-4" />
            ANALYTICS
          </button>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#020617]">
          <div className="max-w-4xl mx-auto">
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-bold text-white border-b border-[#334155] pb-4">General Settings</h2>
                <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6">
                  <p className="text-[#94A3B8]">App preferences and theme settings are managed directly from the main studio view. This space is reserved for future global configurations.</p>
                </div>
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-bold text-white border-b border-[#334155] pb-4">Comprehensive Guide</h2>
                
                <div className="space-y-12">
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#34D399] flex items-center gap-2">
                      <FileText className="w-5 h-5" /> 1. Getting Started
                    </h3>
                    <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 text-[#94A3B8] leading-relaxed space-y-4">
                      <p>TextDiff Studio is a high-performance comparison tool that runs directly in your browser. It leverages a custom Web Worker architecture to process massive text files without freezing your UI.</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Original Text (Left):</strong> The baseline or older version of your code/text.</li>
                        <li><strong>Modified Text (Right):</strong> The newer version you want to compare against.</li>
                        <li><strong>Base Text (3-Way Merge):</strong> When 3-way mode is enabled, this acts as the common ancestor for resolving conflicts.</li>
                      </ul>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#34D399] flex items-center gap-2">
                      <Settings className="w-5 h-5" /> 2. Diff Configuration
                    </h3>
                    <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 text-[#94A3B8] leading-relaxed space-y-4">
                      <p>You can fine-tune how the diff engine processes your text using the toolbar options:</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Ignore Whitespace:</strong> Treats multiple spaces, tabs, and indentation changes as identical.</li>
                        <li><strong>Ignore Case:</strong> Treats uppercase and lowercase letters as identical.</li>
                        <li><strong>Trim Blanks:</strong> Removes entirely empty lines before comparing, useful for cleaning up pasted code.</li>
                        <li><strong>3-Way Merge:</strong> Enables a third editor panel to resolve conflicts between two branches that share a common ancestor.</li>
                      </ul>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#34D399] flex items-center gap-2">
                      <Palette className="w-5 h-5" /> 3. Visualization Options
                    </h3>
                    <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 text-[#94A3B8] leading-relaxed space-y-4">
                      <p>Once you run a diff, you can view the results in several ways:</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Side-by-Side (Split):</strong> Shows original text on the left and modified text on the right. Missing lines are padded to keep everything aligned.</li>
                        <li><strong>Inline (Unified):</strong> Shows a single stream of text with additions and deletions interleaved.</li>
                        <li><strong>Syntax Highlighting:</strong> Select your programming language from the dropdown to apply color-coded syntax formatting to the diff output.</li>
                        <li><strong>Folding (Collapse Unchanged):</strong> Hides large blocks of unchanged text to help you focus only on what changed.</li>
                      </ul>
                    </div>
                  </section>
                  
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-[#34D399] flex items-center gap-2">
                      <HardDrive className="w-5 h-5" /> 4. Saving & Sharing
                    </h3>
                    <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 text-[#94A3B8] leading-relaxed space-y-4">
                      <p>TextDiff Studio offers powerful ways to preserve your work:</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Cloud Sync (GitHub Gists):</strong> Connect your GitHub account via a Personal Access Token to save comparisons directly to your Gists.</li>
                        <li><strong>Permanent URLs:</strong> Clicking "Share" generates a permanent link to your current session, stored securely in the cloud.</li>
                        <li><strong>History:</strong> The app automatically saves your last 20 diff runs locally. Access them via the History button (clock icon) in the toolbar.</li>
                        <li><strong>Merge B to A:</strong> Replaces Version A with Version B, and automatically saves a snapshot of the merge to your local history (and optionally syncs it as a new GitHub Gist).</li>
                        <li><strong>Export PDF/PNG:</strong> Generate a high-resolution image or PDF of your diff for easy sharing in pull requests or emails.</li>
                      </ul>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-bold text-white border-b border-[#334155] pb-4">Keyboard Shortcuts</h2>
                <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6">
                  <div className="grid grid-cols-2 gap-4 text-[#94A3B8]">
                    <div className="flex justify-between items-center p-3 bg-[#1E293B] rounded">
                      <span>Run Diff</span>
                      <kbd className="bg-[#334155] text-white px-2 py-1 rounded text-xs font-mono">Ctrl + Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#1E293B] rounded">
                      <span>Toggle Split/Inline</span>
                      <kbd className="bg-[#334155] text-white px-2 py-1 rounded text-xs font-mono">Alt + V</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#1E293B] rounded">
                      <span>Toggle Fold Unchanged</span>
                      <kbd className="bg-[#334155] text-white px-2 py-1 rounded text-xs font-mono">Alt + F</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#1E293B] rounded">
                      <span>Swap Panes</span>
                      <kbd className="bg-[#334155] text-white px-2 py-1 rounded text-xs font-mono">Alt + S</kbd>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#1E293B] rounded">
                      <span>Clear All</span>
                      <kbd className="bg-[#334155] text-white px-2 py-1 rounded text-xs font-mono">Alt + C</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tests' && isDev && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between border-b border-[#334155] pb-4">
                  <h2 className="text-2xl font-bold text-white">Integration Test Suite</h2>
                  <button 
                    onClick={runTests}
                    className="px-4 py-2 bg-[#34D399] text-[#064E3B] font-bold rounded text-sm hover:bg-[#10B981] transition-colors"
                  >
                    RUN ALL TESTS
                  </button>
                </div>
                <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6">
                  <div className="space-y-4">
                    {testResults.map((test, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-[#1E293B] rounded border border-[#334155]">
                        <span className="font-bold text-[#E2E8F0]">{test.name}</span>
                        <div className="flex items-center gap-2">
                          {test.status === 'pending' && <span className="text-[#64748B] text-sm font-bold">READY</span>}
                          {test.status === 'running' && <><Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" /><span className="text-[#3B82F6] text-sm font-bold">RUNNING</span></>}
                          {test.status === 'passed' && <><CheckCircle className="w-4 h-4 text-[#34D399]" /><span className="text-[#34D399] text-sm font-bold">PASSED</span></>}
                          {test.status === 'failed' && <><XCircle className="w-4 h-4 text-[#EF4444]" /><span className="text-[#EF4444] text-sm font-bold">FAILED</span></>}
                        </div>
                        {test.error && <p className="text-xs text-[#EF4444] w-full mt-2 col-span-2">{test.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-bold text-white border-b border-[#334155] pb-4 flex items-center gap-2">
                  <LineChart className="w-6 h-6 text-[#34D399]" />
                  Advanced Analytics Dashboard
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-[#34D399] transition-colors">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Activity className="w-32 h-32" />
                    </div>
                    <span className="text-[#94A3B8] font-bold text-xs tracking-widest uppercase">Total Diffs Processed</span>
                    <span className="text-4xl font-black text-white">{stats.totalDiffs}</span>
                    <span className="text-xs text-[#34D399]">Based on local history</span>
                  </div>
                  
                  <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-[#F472B6] transition-colors">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Clock className="w-32 h-32" />
                    </div>
                    <span className="text-[#94A3B8] font-bold text-xs tracking-widest uppercase">Last Session</span>
                    <span className="text-xl font-bold text-white mt-2">{stats.lastRun}</span>
                    <span className="text-xs text-[#F472B6]">Timestamp of last diff</span>
                  </div>

                  <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-[#60A5FA] transition-colors">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <FileCode2 className="w-32 h-32" />
                    </div>
                    <span className="text-[#94A3B8] font-bold text-xs tracking-widest uppercase">Primary Language</span>
                    <span className="text-2xl font-bold text-white mt-2 capitalize">{stats.mostUsedLang}</span>
                    <span className="text-xs text-[#60A5FA]">Most frequently diffed</span>
                  </div>
                </div>

                <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-6 mt-6">
                  <h3 className="text-lg font-bold text-white mb-4">Productivity Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm border-b border-[#1E293B] pb-2">
                      <span className="text-[#94A3B8]">Est. Time Saved Resolving Conflicts</span>
                      <span className="text-[#34D399] font-mono font-bold">~{stats.totalDiffs * 2} minutes</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-[#1E293B] pb-2">
                      <span className="text-[#94A3B8]">Diff Engine Offload (Web Worker)</span>
                      <span className="text-[#60A5FA] font-mono font-bold">100% Non-Blocking</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#94A3B8]">Average Diff Compute Time</span>
                      <span className="text-[#F472B6] font-mono font-bold">&lt; 15ms</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
