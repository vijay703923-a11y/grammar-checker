
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, ShieldCheck, AlertCircle, Download, Loader2, ListTree, 
  CheckCircle2, ArrowRight, Quote, Cpu, Wand2, FileText, 
  Type as FontIcon, History, Trash2, ChevronRight, ExternalLink, X
} from 'lucide-react';
import { analyzeText } from './geminiService';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types';
import { Gauge } from './components/Gauge';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Worker initialization
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const LOADING_STEPS = [
  "Connecting to Web Index...", 
  "Scanning Academic Databases...", 
  "Analyzing Syntactic Structure...", 
  "Evaluating AI Fingerprints...", 
  "Finalizing Integrity Report..."
];

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<TextSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const wordCount = useMemo(() => inputText.trim().split(/\s+/).filter(Boolean).length, [inputText]);
  const charCount = inputText.length;

  useEffect(() => {
    let interval: any;
    if (status === AnalysisStatus.ANALYZING) {
      interval = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_STEPS.length), 2000);
    }
    return () => {
      clearInterval(interval);
      setLoadingStep(0);
    };
  }, [status]);

  const handleAnalyze = async () => {
    if (wordCount < 10) {
      setError("Please provide at least 10 words for a meaningful analysis.");
      return;
    }
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    try {
      const data = await analyzeText(inputText);
      setResult(data);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message === "MISSING_API_KEY" ? "API Key is missing. Please check your configuration." : err.message);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractFile(file);
  };

  const extractFile = useCallback(async (file: File) => {
    setIsExtracting(true);
    setError(null);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        setInputText(text.trim());
      } else {
        const text = await file.text();
        setInputText(text);
      }
      setActiveTab('text');
    } catch (e) { 
      setError("Unsupported file format or corrupt file."); 
    } finally { 
      setIsExtracting(false); 
    }
  }, []);

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("VerifyAI Integrity Report", margin, 25);
    
    // Stats Summary
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);
    doc.text(`Originality: ${100 - result.plagiarismPercentage}%`, margin, 50);
    doc.text(`Grammar Score: ${result.grammarScore}%`, margin, 58);
    doc.text(`AI Likelihood: ${result.aiLikelihood}%`, margin, 66);
    doc.text(`Date Generated: ${new Date().toLocaleString()}`, margin, 74);
    
    // Content
    doc.line(margin, 82, pageWidth - margin, 82);
    doc.setFontSize(11);
    const content = result.segments.map(s => s.text).join('');
    const splitContent = doc.splitTextToSize(content, pageWidth - (margin * 2));
    doc.text(splitContent, margin, 92);
    
    doc.save(`VerifyAI_Report_${Date.now()}.pdf`);
  };

  const resetAnalysis = () => {
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setSelectedSegment(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="h-16 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div 
          className="flex items-center gap-2.5 font-extrabold text-2xl tracking-tighter cursor-pointer group"
          onClick={resetAnalysis}
        >
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-600">
            VerifyAI
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-1 text-slate-400 text-xs font-bold uppercase tracking-widest">
            <History size={14} /> Analysis History
          </div>
          <button className="bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-indigo-600 transition-all">
            Upgrade Pro
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 lg:py-16">
        {status !== AnalysisStatus.SUCCESS ? (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-[1.1]">
                Master Your Writing <br/>
                <span className="text-indigo-600">With Absolute Integrity.</span>
              </h1>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                Advanced AI plagiarism detection, structural grammar analysis, and human-like paraphrasing in one unified workspace.
              </p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden transition-all">
              <div className="flex border-b border-slate-50">
                <button 
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-5 text-sm font-bold transition-all ${activeTab === 'text' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <FontIcon size={18} /> Direct Text Entry
                </button>
                <button 
                  onClick={() => setActiveTab('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-5 text-sm font-bold transition-all ${activeTab === 'file' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <FileText size={18} /> Upload Document
                </button>
              </div>

              <div className="p-1">
                {activeTab === 'text' ? (
                  <div className="relative">
                    <textarea 
                      className="w-full h-80 p-10 text-xl font-serif outline-none resize-none leading-relaxed placeholder:text-slate-200"
                      placeholder="Enter your academic or creative content here..."
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                    />
                    <div className="absolute bottom-6 right-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-300 bg-white px-4 py-2 rounded-full border border-slate-50 shadow-sm">
                      <span>{wordCount} Words</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span>{charCount} Chars</span>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-80 flex flex-col items-center justify-center gap-4 cursor-pointer group hover:bg-slate-50 transition-colors"
                  >
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept=".pdf,.txt" />
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {isExtracting ? <Loader2 className="animate-spin" size={32} /> : <FileText size={32} />}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-700">Drop your PDF or TXT here</p>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Max 10MB • Fast Extraction</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <button 
                  onClick={() => setInputText('')}
                  className="flex items-center gap-2 text-slate-400 hover:text-rose-500 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  <Trash2 size={16} /> Clear Text
                </button>
                <button 
                  onClick={handleAnalyze}
                  disabled={status === AnalysisStatus.ANALYZING || !inputText.trim()}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-200"
                >
                  {status === AnalysisStatus.ANALYZING ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      {LOADING_STEPS[loadingStep]}
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Verify Content Integrity
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 p-6 rounded-3xl border border-rose-100 flex items-start gap-4 animate-shake">
                <div className="bg-rose-100 p-2 rounded-xl"><AlertCircle size={20} /></div>
                <div>
                  <h4 className="font-bold text-sm">System Conflict Detected</h4>
                  <p className="text-xs mt-1 font-medium opacity-80">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in zoom-in-95 duration-500">
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex justify-between items-center mb-12 border-b border-slate-50 pb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Audit Insight</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Deep Grounding Verified
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={resetAnalysis} className="flex items-center gap-2 px-5 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all">
                      New Scan
                    </button>
                    <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                      <Download size={16} /> PDF Report
                    </button>
                  </div>
                </div>

                <div className="prose prose-slate max-w-none text-xl leading-relaxed font-serif text-slate-800">
                  {result.segments.map((seg, i) => (
                    <span 
                      key={i} 
                      ref={(el) => { segmentRefs.current[i] = el; }}
                      onClick={() => seg.type !== 'original' && setSelectedSegment(seg)}
                      className={`inline rounded-md px-1 py-0.5 cursor-pointer border-b-4 transition-all duration-300 ${
                        seg.type === 'plagiarism' ? 'bg-rose-50 border-rose-400/50 hover:bg-rose-100' : 
                        seg.type === 'grammar' ? 'bg-amber-50 border-amber-400/50 hover:bg-amber-100' : 'border-transparent'
                      } ${selectedSegment === seg ? 'ring-4 ring-indigo-500/20 bg-indigo-50 border-indigo-500 z-10' : ''}`}
                    >
                      {seg.text}
                    </span>
                  ))}
                </div>

                {result.citations.length > 0 && (
                  <div className="mt-16 pt-10 border-t border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                      <Quote className="w-5 h-5 text-indigo-500" /> Academic Citations (APA)
                    </h3>
                    <div className="grid gap-4">
                      {result.citations.map((cite, i) => (
                        <div key={i} className="group p-5 bg-slate-50 rounded-2xl text-xs text-slate-600 font-mono border border-slate-100 hover:border-indigo-200 transition-all flex items-start gap-4">
                          <span className="text-indigo-300 font-black mt-1">[{i+1}]</span>
                          <span className="italic leading-relaxed">{cite}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/40 space-y-10 sticky top-24">
                <div className="grid grid-cols-2 gap-8">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#F43F5E" />
                  <Gauge value={result.grammarScore} label="Grammar" color="#10B981" />
                </div>
                
                <div className="space-y-6 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Cpu size={16} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Fingerprint</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">{result.aiLikelihood}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><Wand2 size={16} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Writing Tone</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">{result.writingTone}</span>
                  </div>
                </div>

                {selectedSegment ? (
                  <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-2xl animate-in slide-in-from-bottom-6">
                    <div className="flex justify-between items-center mb-6">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${selectedSegment.type === 'plagiarism' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                        {selectedSegment.type} Alert
                      </span>
                      <button onClick={() => setSelectedSegment(null)} className="text-indigo-300 hover:text-white transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <p className="text-sm font-medium leading-relaxed mb-6 opacity-90">
                      {selectedSegment.explanation}
                    </p>

                    {selectedSegment.sourceUrl && (
                      <a 
                        href={selectedSegment.sourceUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 justify-center w-full py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all mb-6"
                      >
                        Explore Source <ExternalLink size={14} />
                      </a>
                    )}

                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-4">Integrity Suggestions</p>
                      {selectedSegment.suggestions?.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            const newSegs = result.segments.map(seg => seg === selectedSegment ? {...seg, text: s, type: 'original' as const} : seg);
                            setResult({...result, segments: newSegs}); 
                            setSelectedSegment(null);
                          }}
                          className="w-full text-left p-4 text-xs font-bold bg-white/5 border border-white/10 rounded-2xl hover:bg-white hover:text-indigo-900 transition-all group flex items-center justify-between"
                        >
                          <span className="truncate mr-4">{s}</span>
                          <ChevronRight size={14} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-600 rounded-3xl p-8 text-white">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2.5">
                      <ListTree size={20} /> Content Map
                    </h3>
                    <div className="space-y-2.5">
                      {result.subtopics.map((t, i) => (
                        <button 
                          key={i} 
                          onClick={() => segmentRefs.current[t.segmentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
                          className="w-full text-left p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex items-center justify-between group"
                        >
                          <span className="truncate">{t.title}</span>
                          <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-100 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-slate-300 text-sm">
            <ShieldCheck size={18} /> VerifyAI Security Standard
          </div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
            Empowered by Gemini 3 Grounding Technology • 2025 Academic Integrity Engine
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
