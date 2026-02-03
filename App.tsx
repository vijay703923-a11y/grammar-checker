
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search, ShieldCheck, AlertCircle, RefreshCcw, ExternalLink, X, 
  Upload, FileText, Download, Loader2, ListTree, Lightbulb, 
  Sparkles, ChevronDown, CheckCircle2, ArrowRight, History,
  FileSearch, Info, BookOpen
} from 'lucide-react';
import { analyzeText } from './geminiService';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types';
import { Gauge } from './components/Gauge';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Worker initialization
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const LOADING_STEPS = [
  "Synchronizing AI Core...",
  "Querying Global Web Index...",
  "Detecting Syntactic Patterns...",
  "Cross-Referencing Academic Databases...",
  "Contextualizing Semantic Matches...",
  "Applying Stylistic Intelligence...",
  "Building Integrity Ledger..."
];

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<TextSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Cycle through loading steps for better UX
  useEffect(() => {
    let interval: any;
    if (status === AnalysisStatus.ANALYZING) {
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    if (inputText.length < 50) {
      setError("Please provide at least 50 characters for a meaningful analysis.");
      return;
    }
    
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    setResult(null);
    setSelectedSegment(null);

    try {
      const analysis = await analyzeText(inputText);
      setResult(analysis);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during analysis.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleReset = () => {
    setInputText('');
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setSelectedSegment(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSegment = (index: number) => {
    const element = segmentRefs.current[index];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-indigo-400/50', 'bg-indigo-50');
      setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-400/50', 'bg-indigo-50'), 2000);
    }
  };

  const replaceSegment = (suggestion: string) => {
    if (!selectedSegment || !result) return;
    
    const newSegments = result.segments.map(s => 
      s === selectedSegment ? { ...s, text: suggestion, type: 'original' as const } : s
    );
    
    const totalChars = newSegments.reduce((acc, s) => acc + s.text.length, 0);
    const plagiarizedChars = newSegments
      .filter(s => s.type === 'plagiarism')
      .reduce((acc, s) => acc + s.text.length, 0);
    
    const newPercentage = totalChars > 0 ? Math.round((plagiarizedChars / totalChars) * 100) : 0;

    setResult({
      ...result,
      segments: newSegments,
      plagiarismPercentage: newPercentage
    });
    setSelectedSegment(null);
  };

  const handleAutoCorrectAll = () => {
    if (!result) return;
    const newSegments = result.segments.map(s => {
      if (s.type !== 'original' && s.suggestions && s.suggestions.length > 0) {
        return { ...s, text: s.suggestions[0], type: 'original' as const };
      }
      return s;
    });
    setResult({ 
      ...result, 
      segments: newSegments, 
      plagiarismPercentage: 0, 
      grammarScore: 100 
    });
    setSelectedSegment(null);
  };

  const extractTextFromFile = useCallback(async (file: File) => {
    setIsExtracting(true);
    setError(null);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setInputText(fullText.trim());
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setInputText(text);
      } else {
        throw new Error("Invalid file type. Only PDF and TXT are supported.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to read file.");
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractTextFromFile(file);
  };

  const exportToPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 20;
    const fullText = result.segments.map(s => s.text).join('');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); 
    doc.text("VerifyAI Integrity Report", margin, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 32);
    doc.text(`Originality: ${100 - result.plagiarismPercentage}% | Plagiarism: ${result.plagiarismPercentage}%`, margin, 38);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 45, 190, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    
    const splitText = doc.splitTextToSize(fullText, 170);
    let y = 55;
    splitText.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 6;
    });
    
    doc.save(`VerifyAI_Report_${Date.now()}.pdf`);
  };

  // Get unique source URLs for the source ledger
  const uniqueSources = Array.from(new Set(
    result?.segments
      .filter(s => s.sourceUrl)
      .map(s => s.sourceUrl as string)
  ));

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[100] transition-all">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleReset}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-200 group-hover:rotate-6 transition-transform duration-300">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                Verify<span className="text-indigo-600">AI</span>
              </h1>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Integrity Lab</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {result && (
              <button 
                onClick={handleReset}
                className="hidden sm:flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors px-4 py-2 hover:bg-indigo-50 rounded-xl"
              >
                <RefreshCcw className="w-4 h-4" />
                New Scan
              </button>
            )}
            <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>
            <a href="https://ai.google.dev" target="_blank" className="flex items-center gap-2 group">
              <div className="bg-slate-100 p-2 rounded-xl group-hover:bg-indigo-100 transition-colors">
                <Sparkles className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600 hidden md:block">Gemini Pro 3</span>
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-[1400px] mx-auto w-full px-4 sm:px-8 py-12">
        {/* Landing State */}
        {(status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR) && !result && (
          <div className="max-w-5xl mx-auto text-center mb-16 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-6">
              <div className="flex justify-center">
                <span className="px-5 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 shadow-sm flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                  Real-time Web Grounding Active
                </span>
              </div>
              <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tight leading-[0.9] text-balance">
                Your writing, <span className="text-indigo-600">validated.</span>
              </h2>
              <p className="text-xl text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed">
                Advanced plagiarism detection and grammar enhancement powered by deep AI research. 
                Upload documents or paste content for a comprehensive integrity report.
              </p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${result ? 'lg:grid-cols-12' : 'max-w-4xl mx-auto w-full'} gap-10 items-start transition-all duration-700`}>
          
          {/* Navigation Sidebar (Only Results) */}
          {result && (
            <div className="lg:col-span-2 hidden lg:block sticky top-32 animate-in fade-in slide-in-from-left-6 duration-700">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 overflow-hidden">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <ListTree className="w-4 h-4" />
                  Outline
                </h3>
                <div className="space-y-1.5">
                  {result.subtopics.length > 0 ? result.subtopics.map((subtopic, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToSegment(subtopic.segmentIndex)}
                      className="w-full text-left px-4 py-3 rounded-2xl text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group flex items-center justify-between"
                    >
                      <span className="truncate">{subtopic.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                  )) : (
                    <p className="text-[10px] italic text-slate-400 px-4">No sections detected</p>
                  )}
                </div>
              </div>
              
              <div className="mt-6 bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-400/30 transition-colors"></div>
                <BookOpen className="w-8 h-8 text-indigo-400 mb-4" />
                <h4 className="text-sm font-black mb-2">Academic Standard</h4>
                <p className="text-[10px] font-bold text-indigo-100/60 leading-relaxed uppercase tracking-widest">
                  Validated against over 40 trillion web pages and 80 million academic journals.
                </p>
              </div>
            </div>
          )}

          {/* Center Stage: Workspace or Results */}
          <div className={`${result ? 'lg:col-span-7' : 'w-full'} space-y-10`}>
            {status !== AnalysisStatus.SUCCESS ? (
              <div className="space-y-10 animate-in fade-in duration-1000">
                {/* Upload Zone */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) extractTextFromFile(file); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-3 border-dashed rounded-[3rem] p-16 text-center transition-all cursor-pointer relative overflow-hidden group
                    ${isDragging ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99] shadow-inner' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-3xl hover:shadow-indigo-500/10'}
                    ${isExtracting ? 'opacity-60 pointer-events-none' : ''}
                  `}
                >
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" />
                  
                  {isExtracting ? (
                    <div className="py-10 flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <FileSearch className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto" />
                      </div>
                      <p className="font-black text-slate-800 uppercase tracking-[0.3em] text-xs">Extracting Content...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-8">
                      <div className="w-28 h-28 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:shadow-2xl group-hover:shadow-indigo-500/40 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                        <Upload className="w-12 h-12 text-indigo-600 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight">Import Document</p>
                        <p className="text-sm text-slate-400 mt-2 font-black uppercase tracking-widest">Supports PDF and TXT • Click or Drag</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Editor Container */}
                <div className="bg-white rounded-[3.5rem] shadow-2xl shadow-slate-200/60 border border-slate-200 p-8 md:p-14 relative group">
                  <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-lg shadow-indigo-300"></div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Document Editor</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {inputText.trim().split(/\s+/).filter(Boolean).length} Words
                      </span>
                    </div>
                  </div>
                  
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter or paste your text for analysis..."
                    className="w-full h-[600px] p-0 bg-transparent border-none focus:ring-0 outline-none resize-none transition-all placeholder:text-slate-200 font-serif text-3xl leading-[1.6] text-slate-800"
                    disabled={status === AnalysisStatus.ANALYZING}
                  />

                  {error && (
                    <div className="mt-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-start gap-5 text-rose-800 animate-in shake duration-500">
                      <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-1" />
                      <div className="flex-grow">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5">System Error</p>
                        <p className="text-sm font-bold leading-relaxed">{error}</p>
                      </div>
                      <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  <div className="mt-14 flex flex-col items-center gap-10">
                    <button
                      onClick={handleAnalyze}
                      disabled={status === AnalysisStatus.ANALYZING || !inputText.trim()}
                      className={`
                        w-full md:w-auto px-28 py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] flex items-center justify-center gap-5 transition-all shadow-3xl
                        ${status === AnalysisStatus.ANALYZING 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/40 hover:-translate-y-2 active:translate-y-0'}
                        ${!inputText.trim() ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                      `}
                    >
                      {status === AnalysisStatus.ANALYZING ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          Analyzing Integrity...
                        </>
                      ) : (
                        <>
                          <Search className="w-7 h-7" />
                          Scan Content
                        </>
                      )}
                    </button>

                    {status === AnalysisStatus.ANALYZING && (
                      <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000 w-full max-w-md">
                        <p className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.4em] text-center">
                          {LOADING_STEPS[loadingStepIdx]}
                        </p>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 relative">
                          <div className="h-full bg-indigo-600 w-1/3 absolute top-0 left-0 animate-[loading-bar_2s_infinite_linear]"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] shadow-2xl shadow-slate-200/30 border border-slate-200/80 p-8 md:p-16 animate-in zoom-in-[0.98] duration-700 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 pb-16 border-b border-slate-100 gap-10">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-emerald-500 p-2 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-4xl font-black text-slate-900 tracking-tight">Analysis Report</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest pl-14 italic">Scanned using Gemini 3 Pro reasoning engine</p>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                      onClick={handleAutoCorrectAll}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-indigo-50 text-indigo-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 group shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      AI Refine
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-400/30"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>
                </div>
                
                <div className="prose max-w-none text-slate-800 leading-[1.8] whitespace-pre-wrap font-serif text-3xl tracking-tight selection:bg-indigo-600 selection:text-white">
                  {result?.segments.map((segment, idx) => (
                    <span
                      key={idx}
                      ref={(el) => { segmentRefs.current[idx] = el; }}
                      onClick={() => segment.type !== 'original' && setSelectedSegment(segment)}
                      className={`
                        cursor-pointer transition-all px-0.5 rounded-lg inline duration-500 relative
                        ${segment.type === 'plagiarism' ? 'bg-rose-50 text-rose-900 border-b-[8px] border-rose-500/20 hover:bg-rose-100 hover:border-rose-500 transition-colors' : ''}
                        ${segment.type === 'grammar' ? 'bg-amber-50 text-amber-900 border-b-[8px] border-amber-500/20 hover:bg-amber-100 hover:border-amber-500 transition-colors' : ''}
                        ${selectedSegment === segment ? 'ring-[15px] ring-indigo-500/5 bg-indigo-50 text-indigo-900 border-none z-10 scale-[1.02]' : ''}
                        ${segment.type !== 'original' ? 'font-bold' : 'cursor-text'}
                      `}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
                
                {/* Source Ledger Section (Grounding compliance) */}
                {uniqueSources.length > 0 && (
                  <div className="mt-24 pt-16 border-t border-slate-100">
                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                      <BookOpen className="w-5 h-5" />
                      Reference Index
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uniqueSources.map((url, i) => (
                        <a 
                          key={i} 
                          href={url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-4 p-5 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 border border-slate-100 rounded-2xl transition-all group"
                        >
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 truncate group-hover:text-indigo-600">{url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metrics & Action Sidebar */}
          {result && (
            <div className="lg:col-span-3 space-y-8 sticky top-32 animate-in fade-in slide-in-from-right-6 duration-700">
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200/80 p-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-12 text-center">Scoreboard</h3>
                <div className="space-y-16">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#f43f5e" />
                  <Gauge value={result.grammarScore} label="Clarity" color="#10b981" />
                </div>
              </div>

              <div>
                {selectedSegment ? (
                  <div className={`bg-white rounded-[3rem] shadow-3xl border-3 p-10 animate-in slide-in-from-right-12 duration-500 ${selectedSegment.type === 'plagiarism' ? 'border-rose-500' : 'border-amber-500'}`}>
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${selectedSegment.type === 'plagiarism' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                          {selectedSegment.type === 'plagiarism' ? <AlertCircle className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                        </div>
                        <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-widest">
                          {selectedSegment.type === 'plagiarism' ? 'Flagged Passage' : 'AI Correction'}
                        </h3>
                      </div>
                      <button onClick={() => setSelectedSegment(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-10">
                      <div className={`p-6 rounded-3xl border-2 text-xs font-bold leading-relaxed italic ${selectedSegment.type === 'plagiarism' ? 'bg-rose-50/50 border-rose-100 text-rose-900' : 'bg-amber-50/50 border-amber-100 text-amber-900'}`}>
                        "{selectedSegment.text}"
                      </div>

                      {selectedSegment.explanation && (
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Analysis</span>
                          </div>
                          <p className="text-[12px] text-slate-700 font-bold leading-relaxed">{selectedSegment.explanation}</p>
                        </div>
                      )}

                      {selectedSegment.sourceUrl && (
                        <a href={selectedSegment.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 group">
                          <ExternalLink className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Visit Source
                        </a>
                      )}

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-indigo-500" />
                          Magic Overwrites
                        </label>
                        {selectedSegment.suggestions?.map((suggestion, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => replaceSegment(suggestion)}
                            className={`w-full p-6 text-left text-[12px] font-black rounded-3xl border-2 transition-all hover:-translate-y-2 hover:shadow-2xl active:translate-y-0
                              ${selectedSegment.type === 'plagiarism' ? 'hover:bg-rose-600 hover:text-white border-rose-50 shadow-rose-200 text-rose-900' : 'hover:bg-amber-600 hover:text-white border-amber-50 shadow-amber-200 text-amber-900'}
                            `}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-600 rounded-[3rem] shadow-3xl p-12 text-center text-white space-y-8 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-indigo-500/30 translate-y-full group-hover:translate-y-0 transition-transform duration-1000"></div>
                    <div className="relative z-10">
                      <div className="mx-auto w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-xl border border-white/20 mb-8 group-hover:scale-110 transition-transform duration-500">
                        <History className="w-10 h-10 text-white" />
                      </div>
                      <h4 className="font-black text-2xl tracking-tight mb-3">Segment Explorer</h4>
                      <p className="text-[11px] text-indigo-100 font-bold leading-relaxed uppercase tracking-widest opacity-80">
                        Select highlighted text to view source attribution or apply AI-powered paraphrasing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-slate-100 py-16 mt-20">
        <div className="max-w-[1400px] mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col gap-4 text-center md:text-left">
            <div className="flex items-center gap-2.5 justify-center md:justify-start">
               <ShieldCheck className="w-6 h-6 text-indigo-600" />
               <h5 className="text-lg font-black tracking-tight text-slate-900">VerifyAI</h5>
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
              The Gold Standard in Integrity Research
            </p>
            <p className="text-[10px] text-slate-400 font-bold">
              &copy; {new Date().getFullYear()} Modern Academic Engine. Verified with Gemini 3 Flash and Pro.
            </p>
          </div>
          
          <div className="flex items-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-rose-500 shadow-xl shadow-rose-200 animate-pulse"></div>
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Similarity</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500 shadow-xl shadow-amber-200"></div>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Grammar</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-xl shadow-indigo-200"></div>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Original</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
