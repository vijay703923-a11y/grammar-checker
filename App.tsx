
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, ShieldCheck, AlertCircle, Download, Loader2, ListTree, 
  CheckCircle2, ArrowRight, Quote, Cpu, Wand2, FileText, 
  Type as TypeIcon, History, Trash2, ChevronRight, ExternalLink, X
} from 'lucide-react';
import { analyzeText } from './geminiService.ts';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types.ts';
import { Gauge } from './components/Gauge.tsx';
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

  const wordCount = useMemo(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [inputText]);

  const charCount = inputText.length;

  useEffect(() => {
    let interval: any;
    if (status === AnalysisStatus.ANALYZING) {
      interval = setInterval(() => {
        setLoadingStep(s => (s + 1) % LOADING_STEPS.length);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
      setLoadingStep(0);
    };
  }, [status]);

  const handleAnalyze = async () => {
    if (wordCount < 5) {
      setError("Please provide at least 5 words for analysis.");
      return;
    }
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    try {
      const data = await analyzeText(inputText);
      setResult(data);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      const msg = err.message === "MISSING_API_KEY" 
        ? "API Key is missing. Please check your environment configuration." 
        : err.message;
      setError(msg);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractFile(file);
    if (e.target) e.target.value = ''; // Allow re-selecting same file
  };

  const extractFile = useCallback(async (file: File) => {
    setIsExtracting(true);
    setError(null);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str || '')
            .join(' ');
          fullText += pageText + '\n';
        }
        setInputText(fullText.trim());
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setInputText(text);
      } else {
        throw new Error("Unsupported file format. Please upload PDF or TXT.");
      }
      setActiveTab('text');
    } catch (e: any) { 
      setError(e.message || "Could not extract text from document."); 
    } finally { 
      setIsExtracting(false); 
    }
  }, []);

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let cursorY = 50;

    const checkPageBreak = (needed: number) => {
      if (cursorY + needed > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };
    
    // Styled Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("VerifyAI Content Integrity Report", margin, 25);
    
    // Quick Stats
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.text(`Originality: ${100 - result.plagiarismPercentage}%`, margin, cursorY);
    doc.text(`Grammar Accuracy: ${result.grammarScore}%`, margin, cursorY + 8);
    doc.text(`AI Probability: ${result.aiLikelihood}%`, margin, cursorY + 16);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY + 24);
    
    cursorY += 40;
    doc.line(margin, cursorY - 5, pageWidth - margin, cursorY - 5);
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    
    const content = result.segments.map(s => s.text).join('');
    const splitLines = doc.splitTextToSize(content, pageWidth - (margin * 2));
    
    splitLines.forEach((line: string) => {
      checkPageBreak(7);
      doc.text(line, margin, cursorY);
      cursorY += 7;
    });

    if (result.citations.length > 0) {
      cursorY += 15;
      checkPageBreak(25);
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text("References", margin, cursorY);
      cursorY += 10;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      
      result.citations.forEach((cite) => {
        const splitCite = doc.splitTextToSize(cite, pageWidth - (margin * 2));
        checkPageBreak(splitCite.length * 5 + 5);
        doc.text(splitCite, margin, cursorY);
        cursorY += (splitCite.length * 5) + 3;
      });
    }
    
    doc.save(`VerifyAI_Audit_${Date.now()}.pdf`);
  };

  const resetAnalysis = () => {
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setSelectedSegment(null);
    setError(null);
    setInputText('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="h-16 bg-white border-b px-6 lg:px-12 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div 
          className="flex items-center gap-2.5 font-extrabold text-xl lg:text-2xl tracking-tighter cursor-pointer group"
          onClick={() => status === AnalysisStatus.SUCCESS ? resetAnalysis() : null}
        >
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white group-hover:rotate-6 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-600">
            VerifyAI
          </span>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          <button className="hidden sm:flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors">
            <History size={14} /> Audit Log
          </button>
          <button className="bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-indigo-600 transition-all shadow-md active:scale-95">
            Upgrade Pro
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 lg:py-16">
        {status !== AnalysisStatus.SUCCESS ? (
          <div className="max-w-4xl mx-auto space-y-10 lg:space-y-14">
            <div className="text-center space-y-5">
              <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-[1.1]">
                Master Your Writing <br/>
                <span className="text-indigo-600">With Absolute Confidence.</span>
              </h1>
              <p className="text-slate-500 text-base lg:text-xl max-w-2xl mx-auto leading-relaxed">
                Elite plagiarism detection, structural grammar analysis, and AI fingerprinting in one powerful academic workspace.
              </p>
            </div>

            <div className="bg-white rounded-3xl lg:rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
              <div className="flex border-b border-slate-50">
                <button 
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 lg:py-6 text-sm font-bold transition-all ${activeTab === 'text' ? 'text-indigo-600 bg-indigo-50/30 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <TypeIcon size={18} /> Direct Text
                </button>
                <button 
                  onClick={() => setActiveTab('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 lg:py-6 text-sm font-bold transition-all ${activeTab === 'file' ? 'text-indigo-600 bg-indigo-50/30 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <FileText size={18} /> File Upload
                </button>
              </div>

              <div className="relative">
                {activeTab === 'text' ? (
                  <div className="relative">
                    <textarea 
                      className="w-full h-72 lg:h-96 p-8 lg:p-12 text-lg lg:text-xl font-serif outline-none resize-none leading-relaxed placeholder:text-slate-200"
                      placeholder="Paste your essay, paper, or document here..."
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                    />
                    <div className="absolute bottom-6 right-8 lg:bottom-10 lg:right-12 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                      <span>{wordCount} Words</span>
                      <span className="w-1.5 h-1.5 bg-slate-100 rounded-full" />
                      <span>{charCount} Characters</span>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-72 lg:h-96 flex flex-col items-center justify-center gap-5 cursor-pointer group hover:bg-slate-50 transition-colors"
                  >
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept=".pdf,.txt" />
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center group-hover:scale-105 transition-all duration-300 shadow-inner">
                      {isExtracting ? <Loader2 className="animate-spin" size={32} /> : <FileText size={32} />}
                    </div>
                    <div className="text-center px-6">
                      <p className="font-bold text-slate-800 text-lg">Drop your PDF or TXT</p>
                      <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-black">Encrypted & Private Processing</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 lg:p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                <button 
                  onClick={() => setInputText('')}
                  className="flex items-center gap-2 text-slate-400 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  <Trash2 size={16} /> Clear Content
                </button>
                <button 
                  onClick={handleAnalyze}
                  disabled={status === AnalysisStatus.ANALYZING || !inputText.trim()}
                  className="w-full sm:w-auto bg-indigo-600 text-white px-10 lg:px-14 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]"
                >
                  {status === AnalysisStatus.ANALYZING ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      {LOADING_STEPS[loadingStep]}
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Verify Integrity
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 p-6 rounded-3xl border border-rose-100 flex items-start gap-5 animate-shake shadow-sm">
                <div className="bg-rose-100 p-2.5 rounded-xl shrink-0"><AlertCircle size={20} /></div>
                <div>
                  <h4 className="font-bold text-sm">Analysis Interrupt</h4>
                  <p className="text-xs mt-1 font-medium opacity-80 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="lg:col-span-8 space-y-8 lg:space-y-10">
              <div className="bg-white rounded-[2.5rem] p-8 lg:p-14 border border-slate-100 shadow-xl shadow-slate-200/30">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 mb-12 border-b border-slate-50 pb-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Audit Findings</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3 flex items-center gap-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500" /> Deep Search Grounding Verified
                    </p>
                  </div>
                  <div className="flex gap-4 w-full sm:w-auto">
                    <button onClick={resetAnalysis} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-100 transition-all">
                      New Audit
                    </button>
                    <button onClick={exportPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                      <Download size={16} /> Export PDF
                    </button>
                  </div>
                </div>

                <div className="prose prose-slate max-w-none text-xl leading-[1.8] font-serif text-slate-800">
                  <div className="whitespace-pre-wrap">
                    {result.segments.map((seg, i) => (
                      <span 
                        key={i} 
                        ref={(el) => { segmentRefs.current[i] = el; }}
                        onClick={() => seg.type !== 'original' && setSelectedSegment(seg)}
                        className={`inline cursor-pointer transition-all duration-300 rounded px-1 border-b-[3px] ${
                          seg.type === 'plagiarism' ? 'bg-rose-50 border-rose-300/60 hover:bg-rose-100' : 
                          seg.type === 'grammar' ? 'bg-amber-50 border-amber-300/60 hover:bg-amber-100' : 'border-transparent'
                        } ${selectedSegment === seg ? 'ring-4 ring-indigo-500/10 bg-indigo-50 border-indigo-500 border-b-0' : ''}`}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </div>
                </div>

                {result.citations.length > 0 && (
                  <div className="mt-20 pt-12 border-t border-slate-100">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-3">
                      <Quote className="w-5 h-5 text-indigo-500" /> Grounded References (APA)
                    </h3>
                    <div className="grid gap-4">
                      {result.citations.map((cite, i) => (
                        <div key={i} className="p-6 bg-slate-50/70 rounded-2xl text-xs text-slate-600 font-mono leading-relaxed border border-transparent hover:border-slate-200 transition-all flex items-start gap-4">
                          <span className="text-indigo-400 font-black mt-0.5 shrink-0">[{i+1}]</span>
                          <span>{cite}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8 lg:space-y-10">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/30 space-y-12 lg:sticky lg:top-24">
                <div className="grid grid-cols-2 gap-8">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#F43F5E" />
                  <Gauge value={result.grammarScore} label="Grammar" color="#10B981" />
                </div>
                
                <div className="space-y-6 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
                      <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600"><Cpu size={16} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Fingerprint</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">{result.aiLikelihood}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
                      <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600"><Wand2 size={16} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Writing Tone</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">{result.writingTone}</span>
                  </div>
                </div>

                {selectedSegment ? (
                  <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden relative">
                    <div className="flex justify-between items-center mb-8">
                      <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-4 py-1.5 rounded-full ${selectedSegment.type === 'plagiarism' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                        {selectedSegment.type} Insight
                      </span>
                      <button onClick={() => setSelectedSegment(null)} className="text-white/30 hover:text-white transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <p className="text-sm font-medium leading-relaxed mb-8 text-slate-300 italic">
                      "{selectedSegment.explanation}"
                    </p>

                    {selectedSegment.sourceUrl && (
                      <a 
                        href={selectedSegment.sourceUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2.5 justify-center w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all mb-8 group"
                      >
                        Verify Original Source <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    )}

                    {selectedSegment.suggestions && selectedSegment.suggestions.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Integrity Revisions</p>
                        <div className="grid gap-2.5">
                          {selectedSegment.suggestions.map((s, i) => (
                            <button 
                              key={i} 
                              onClick={() => {
                                const newSegments = result.segments.map(seg => 
                                  seg === selectedSegment ? {...seg, text: s, type: 'original' as const} : seg
                                );
                                setResult({...result, segments: newSegments});
                                setSelectedSegment(null);
                              }}
                              className="w-full text-left p-4 text-xs font-bold bg-white/5 border border-white/10 rounded-2xl hover:bg-white hover:text-slate-900 transition-all flex items-center justify-between group"
                            >
                              <span className="line-clamp-2 pr-4">{s}</span>
                              <ChevronRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-indigo-600 rounded-[2rem] p-8 lg:p-10 text-white shadow-xl">
                    <h3 className="font-bold text-lg mb-8 flex items-center gap-3">
                      <ListTree size={20} /> Content Logic
                    </h3>
                    <div className="space-y-2.5">
                      {result.subtopics.map((t, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            const el = segmentRefs.current[t.segmentIndex];
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }} 
                          className="w-full text-left p-4 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex items-center justify-between group"
                        >
                          <span className="truncate pr-4">{t.title}</span>
                          <ArrowRight size={14} className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
      
      <footer className="max-w-7xl mx-auto px-8 py-20 border-t border-slate-100 text-center">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2.5 font-bold text-slate-300 text-sm">
            <ShieldCheck size={20} /> VerifyAI Academic Protocol 2.5
          </div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] max-w-2xl leading-loose">
            Enterprise Integrity Standard • AI Detection Engine v4.0 • Zero Training Privacy Protocol
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
