import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ShieldCheck, AlertCircle, RefreshCcw, ExternalLink, X, Upload, FileText, Download, Loader2, ListTree, Lightbulb, Sparkles, ChevronDown, CheckCircle2 } from 'lucide-react';
import { analyzeText } from './geminiService';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types';
import { Gauge } from './components/Gauge';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Using a worker version that exactly matches the API version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const LOADING_STEPS = [
  "Initializing Secure Connection...",
  "Scanning Global Web Databases...",
  "Analyzing Linguistic Patterns...",
  "Cross-Referencing Sources...",
  "Identifying Grammar Nuances...",
  "Generating Smart Suggestions...",
  "Finalizing Integrity Report..."
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

  // Cycle through loading messages
  useEffect(() => {
    let interval: any;
    if (status === AnalysisStatus.ANALYZING) {
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3000);
    } else {
      setLoadingStepIdx(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    
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
      setError(err.message || "Analysis failed. Please try again later.");
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
      element.classList.add('ring-4', 'ring-indigo-400/30', 'bg-indigo-50');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-indigo-400/30', 'bg-indigo-50');
      }, 2000);
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
        throw new Error("Unsupported format. Please upload a PDF or TXT file.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract text from the file.");
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
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("VerifyAI Document Report", margin, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 32);
    doc.text(`Plagiarism: ${result.plagiarismPercentage}% | Grammar: ${result.grammarScore}%`, margin, 38);
    
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(margin, 45, 190, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // Slate-800
    
    const splitText = doc.splitTextToSize(fullText, 170);
    let y = 55;
    splitText.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 6;
    });
    
    doc.save(`VerifyAI_Analysis_${Date.now()}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 group cursor-pointer" onClick={handleReset}>
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100 group-hover:rotate-12 transition-transform">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Verify<span className="text-indigo-600">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {result && (
              <button 
                onClick={handleReset}
                className="text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 hover:bg-slate-50 rounded-lg"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Clear Session
              </button>
            )}
            <a href="https://github.com" target="_blank" className="text-slate-400 hover:text-slate-600 transition-colors">
              <span className="sr-only">GitHub</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {(status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR) && !result && (
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-8 animate-in fade-in slide-in-from-top-6 duration-1000">
            <div className="flex flex-col items-center gap-4">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm">
                <Sparkles className="w-3 h-3" />
                Powered by Gemini 3 Flash
              </span>
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.05]">
                Academic Integrity,<br/>
                <span className="text-indigo-600">Perfected.</span>
              </h2>
              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                Scan your writing for plagiarism and grammar issues with real-time web verification and AI-powered rewrites.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Structure Sidebar */}
          {result && (
            <div className="lg:col-span-2 hidden lg:block sticky top-24 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                  <ListTree className="w-3.5 h-3.5" />
                  Navigation
                </h3>
                <div className="space-y-1">
                  {result.subtopics.map((subtopic, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToSegment(subtopic.segmentIndex)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-between group"
                    >
                      <span className="truncate">{subtopic.title}</span>
                      <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 -rotate-90 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Workspace */}
          <div className={`${result ? 'lg:col-span-7' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-8`}>
            {status !== AnalysisStatus.SUCCESS ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) extractTextFromFile(file); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-[3rem] p-12 text-center transition-all cursor-pointer group
                    ${isDragging ? 'border-indigo-600 bg-indigo-50 scale-[0.98] shadow-inner' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/5'}
                    ${isExtracting ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" />
                  {isExtracting ? (
                    <div className="py-6 flex flex-col items-center gap-5">
                      <div className="relative">
                        <Loader2 className="w-14 h-14 text-indigo-600 animate-spin" />
                        <FileText className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
                      </div>
                      <p className="font-black text-slate-700 uppercase tracking-widest text-xs">Processing Document...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:shadow-xl group-hover:shadow-indigo-500/30 transition-all duration-500 ease-out">
                        <Upload className="w-10 h-10 text-indigo-600 group-hover:text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">Drop your paper</p>
                        <p className="text-sm text-slate-400 mt-2 font-bold uppercase tracking-widest">Supports PDF and Text Files</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[3.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 p-10 md:p-14 overflow-hidden relative">
                  <div className="mb-8 flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      Content to Analyze
                    </label>
                    <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                      {inputText.trim().split(/\s+/).filter(Boolean).length} Words
                    </span>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Paste your content here or upload a file above..."
                      className="w-full h-[500px] p-10 bg-slate-50/50 border border-slate-100 rounded-[2.5rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-200 outline-none resize-none transition-all placeholder:text-slate-300 font-serif text-2xl leading-relaxed text-slate-700 scroll-smooth"
                      disabled={status === AnalysisStatus.ANALYZING}
                    />
                    {!inputText && (
                      <div className="absolute top-10 left-10 pointer-events-none opacity-10">
                         <FileText className="w-40 h-40 text-indigo-900" />
                      </div>
                    )}
                  </div>
                  
                  {error && (
                    <div className="mt-8 p-6 bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-[2rem] flex items-start gap-5 text-red-800 animate-in shake duration-500 shadow-xl shadow-red-500/10">
                      <div className="bg-red-500 p-2.5 rounded-full text-white shrink-0 shadow-lg shadow-red-200">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-grow">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1.5">System Alert</p>
                        <p className="text-sm font-bold opacity-90">{error}</p>
                      </div>
                      <button 
                        onClick={() => setError(null)}
                        className="p-2 hover:bg-red-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="mt-12 flex flex-col items-center gap-8">
                    <button
                      onClick={handleAnalyze}
                      disabled={status === AnalysisStatus.ANALYZING || !inputText.trim()}
                      className={`
                        w-full md:w-auto px-24 py-6 rounded-3xl font-black text-sm uppercase tracking-[0.25em] flex items-center justify-center gap-4 transition-all shadow-2xl
                        ${status === AnalysisStatus.ANALYZING 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-[#5046e5] text-white hover:bg-[#4338ca] hover:shadow-indigo-500/40 hover:-translate-y-1.5 active:translate-y-0'}
                        ${!inputText.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                      `}
                    >
                      {status === AnalysisStatus.ANALYZING ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Running AI Diagnostics
                        </>
                      ) : (
                        <>
                          <Search className="w-6 h-6" />
                          Verify Integrity
                        </>
                      )}
                    </button>

                    {status === AnalysisStatus.ANALYZING && (
                      <div className="flex flex-col items-center gap-3 animate-in fade-in duration-1000">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.35em] transition-all">
                          {LOADING_STEPS[loadingStepIdx]}
                        </p>
                        <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div className="h-full bg-indigo-600 animate-[loading-bar_2.5s_infinite_linear]"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] shadow-2xl shadow-slate-200/40 border border-slate-200 p-10 md:p-16 animate-in zoom-in-[0.98] duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 pb-12 border-b border-slate-100 gap-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">Scan Results</h3>
                    </div>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest pl-11">Review highlights for academic integrity</p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={handleAutoCorrectAll}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 group"
                    >
                      <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                      Magic Fix
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-400/20"
                    >
                      <Download className="w-4 h-4" />
                      Save PDF
                    </button>
                  </div>
                </div>
                
                <div className="prose max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-serif text-3xl tracking-tight selection:bg-indigo-100">
                  {result?.segments.map((segment, idx) => (
                    <span
                      key={idx}
                      ref={(el) => { segmentRefs.current[idx] = el; }}
                      onClick={() => segment.type !== 'original' && setSelectedSegment(segment)}
                      className={`
                        cursor-pointer transition-all px-0.5 rounded-lg inline-block duration-500
                        ${segment.type === 'plagiarism' ? 'bg-red-50 text-red-900 border-b-[6px] border-red-500/30 hover:bg-red-100 hover:border-red-500' : ''}
                        ${segment.type === 'grammar' ? 'bg-amber-50 text-amber-900 border-b-[6px] border-amber-500/30 hover:bg-amber-100 hover:border-amber-500' : ''}
                        ${selectedSegment === segment ? 'ring-[12px] ring-indigo-500/10 bg-indigo-50 text-indigo-900 border-none scale-105 z-10' : ''}
                        ${segment.type !== 'original' ? 'font-black' : 'cursor-text hover:bg-slate-50'}
                      `}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Details & Metrics Sidebar */}
          {result && (
            <div className="lg:col-span-3 space-y-8 sticky top-24 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-12 text-center">Diagnostics</h3>
                <div className="grid grid-cols-1 gap-14">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#f43f5e" />
                  <Gauge value={result.grammarScore} label="Writing Score" color="#10b981" />
                </div>
              </div>

              <div>
                {selectedSegment ? (
                  <div className={`bg-white rounded-[3rem] shadow-2xl border-2 p-10 animate-in slide-in-from-right-10 duration-500 ${selectedSegment.type === 'plagiarism' ? 'border-red-500' : 'border-amber-500'}`}>
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${selectedSegment.type === 'plagiarism' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {selectedSegment.type === 'plagiarism' ? <AlertCircle className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                        </div>
                        <h3 className="font-black text-slate-900 text-[11px] uppercase tracking-widest">
                          {selectedSegment.type === 'plagiarism' ? 'Match Detected' : 'Grammar Advice'}
                        </h3>
                      </div>
                      <button onClick={() => setSelectedSegment(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-10">
                      <div className={`p-6 rounded-[2rem] border text-xs font-bold leading-relaxed italic ${selectedSegment.type === 'plagiarism' ? 'bg-red-50 border-red-100 text-red-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                        "{selectedSegment.text}"
                      </div>

                      {selectedSegment.explanation && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">AI Explanation</span>
                          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">{selectedSegment.explanation}</p>
                        </div>
                      )}

                      {selectedSegment.sourceUrl && (
                        <a href={selectedSegment.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                          <ExternalLink className="w-4 h-4" /> View Source URL
                        </a>
                      )}

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                          Suggested Alternatives
                        </label>
                        {selectedSegment.suggestions?.map((suggestion, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => replaceSegment(suggestion)}
                            className={`w-full p-6 text-left text-xs font-black rounded-2xl border-2 transition-all hover:-translate-y-1.5 hover:shadow-xl ${selectedSegment.type === 'plagiarism' ? 'hover:bg-red-600 hover:text-white border-red-50 shadow-red-100' : 'hover:bg-amber-600 hover:text-white border-amber-50 shadow-amber-100'}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-600 rounded-[3rem] shadow-2xl p-12 text-center text-white space-y-6 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                    <div className="relative z-10">
                      <div className="mx-auto w-20 h-20 bg-white/10 rounded-[2.2rem] flex items-center justify-center backdrop-blur-md border border-white/20 mb-6">
                        <Lightbulb className="w-10 h-10 text-white" />
                      </div>
                      <h4 className="font-black text-xl tracking-tight mb-2">Detailed Analysis</h4>
                      <p className="text-xs text-indigo-100 font-bold leading-relaxed uppercase tracking-widest opacity-80">
                        Click on flagged areas to see specific AI improvements and web sources.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 py-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] text-center md:text-left">
              VerifyAI Precision Engine
            </p>
            <p className="text-[9px] text-slate-300 font-bold text-center md:text-left">
              &copy; {new Date().getFullYear()} Modern Academic Solutions. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-10">
            <span className="flex items-center gap-4 text-[11px] font-black text-red-500 uppercase tracking-widest">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-xl shadow-red-200 animate-pulse"></div> Plagiarism
            </span>
            <span className="flex items-center gap-4 text-[11px] font-black text-amber-500 uppercase tracking-widest">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-xl shadow-amber-200"></div> Grammar
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
