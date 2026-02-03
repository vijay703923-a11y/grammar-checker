
import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, ShieldCheck, AlertCircle, RefreshCcw, ExternalLink, X, Upload, FileText, Download, Loader2, ListTree, Lightbulb, Sparkles, ArrowRight } from 'lucide-react';
import { analyzeText } from './geminiService';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types';
import { Gauge } from './components/Gauge';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Using a slightly more robust worker URL for pdf.js in ESM environments
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

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
      }, 2500);
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
      setError(err.message || "Failed to analyze. Please check your connection.");
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
    
    const plagiarizedCount = newSegments.filter(s => s.type === 'plagiarism').length;
    const totalLength = newSegments.length;
    const newPercentage = totalLength > 0 ? Math.round((plagiarizedCount / totalLength) * 100) : 0;

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
    setResult({ ...result, segments: newSegments, plagiarismPercentage: 0, grammarScore: 100 });
    setSelectedSegment(null);
  };

  const extractTextFromFile = async (file: File) => {
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
      } else if (file.type === 'text/plain') {
        const text = await file.text();
        setInputText(text);
      } else {
        throw new Error("Invalid file type. Please upload PDF or TXT.");
      }
    } catch (err: any) {
      setError(err.message || "Error reading file.");
    } finally {
      setIsExtracting(false);
    }
  };

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
    doc.setFontSize(18);
    doc.text("VerifyAI - Corrected Document Report", margin, margin);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, margin + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(fullText, 170);
    let y = 45;
    splitText.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 6;
    });
    doc.save("VerifyAI_Report.pdf");
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
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
                className="text-slate-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                New Check
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {status === AnalysisStatus.IDLE && !result && (
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
            <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
              High-Speed Academic Integrity
            </span>
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Write with <span className="text-indigo-600">total confidence</span>.
            </h2>
            <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
              Real-time plagiarism detection and grammar fixing powered by Gemini 3 Flash.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Outline */}
          {result && (
            <div className="lg:col-span-2 hidden lg:block sticky top-24">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                  <ListTree className="w-3.5 h-3.5" />
                  Structure
                </h3>
                <div className="space-y-1">
                  {result.subtopics.map((subtopic, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToSegment(subtopic.segmentIndex)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-between group"
                    >
                      <span className="truncate">{subtopic.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Center: Main Editor/Display */}
          <div className={`${result ? 'lg:col-span-7' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-6`}>
            {status !== AnalysisStatus.SUCCESS ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) extractTextFromFile(file); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-[3rem] p-12 text-center transition-all cursor-pointer group
                    ${isDragging ? 'border-indigo-600 bg-indigo-50 scale-[0.98]' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/5'}
                    ${isExtracting ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" />
                  {isExtracting ? (
                    <div className="py-6 flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <p className="font-black text-slate-700 uppercase tracking-widest text-xs">Extracting Text...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-5">
                      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 transition-all duration-500 ease-out">
                        <Upload className="w-10 h-10 text-indigo-600 group-hover:text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">Import Document</p>
                        <p className="text-sm text-slate-400 mt-1.5 font-bold uppercase tracking-widest">PDF or Plain Text</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10">
                  <div className="mb-6 flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Original Content
                    </label>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      {inputText.length} Characters
                    </span>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your essay, article, or research paper here..."
                    className="w-full h-96 p-8 bg-slate-50/30 border border-slate-100 rounded-[2rem] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-400 outline-none resize-none transition-all placeholder:text-slate-300 font-serif text-xl leading-relaxed text-slate-700"
                    disabled={status === AnalysisStatus.ANALYZING}
                  />
                  
                  {error && (
                    <div className="mt-8 p-5 bg-red-50 border border-red-100 rounded-[1.5rem] flex items-center gap-4 text-red-700 animate-in shake duration-500">
                      <AlertCircle className="w-6 h-6 shrink-0" />
                      <p className="text-sm font-black uppercase tracking-tight">{error}</p>
                    </div>
                  )}

                  <div className="mt-10 flex flex-col items-center gap-6">
                    <button
                      onClick={handleAnalyze}
                      disabled={status === AnalysisStatus.ANALYZING || !inputText.trim()}
                      className={`
                        px-16 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 transition-all
                        ${status === AnalysisStatus.ANALYZING 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0'}
                      `}
                    >
                      {status === AnalysisStatus.ANALYZING ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          Verify Integrity
                        </>
                      )}
                    </button>

                    {status === AnalysisStatus.ANALYZING && (
                      <div className="flex flex-col items-center gap-2 animate-in fade-in duration-1000">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] transition-all">
                          {LOADING_STEPS[loadingStepIdx]}
                        </p>
                        <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 animate-[loading-bar_2s_infinite_linear]"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 p-10 md:p-14 animate-in zoom-in-95 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-10 border-b border-slate-100 gap-6">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Verified Result</h3>
                    <p className="text-sm text-slate-400 font-bold mt-2 uppercase tracking-widest">Click on highlights to view AI insights</p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={handleAutoCorrectAll}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                      <Sparkles className="w-4 h-4" />
                      Magic Fix
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200/50"
                    >
                      <Download className="w-4 h-4" />
                      Save PDF
                    </button>
                  </div>
                </div>
                
                <div className="prose max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-serif text-2xl tracking-tight selection:bg-indigo-100">
                  {result?.segments.map((segment, idx) => (
                    <span
                      key={idx}
                      ref={(el) => { segmentRefs.current[idx] = el; }}
                      onClick={() => segment.type !== 'original' && setSelectedSegment(segment)}
                      className={`
                        cursor-pointer transition-all px-0.5 rounded-lg inline-block duration-300
                        ${segment.type === 'plagiarism' ? 'bg-red-50 text-red-900 border-b-4 border-red-500/50 hover:bg-red-100' : ''}
                        ${segment.type === 'grammar' ? 'bg-amber-50 text-amber-900 border-b-4 border-amber-500/50 hover:bg-amber-100' : ''}
                        ${selectedSegment === segment ? 'ring-8 ring-indigo-500/10 bg-indigo-50 text-indigo-900 border-none' : ''}
                        ${segment.type !== 'original' ? 'font-black' : 'cursor-text'}
                      `}
                    >
                      {segment.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Scores & Details */}
          {result && (
            <div className="lg:col-span-3 space-y-6 sticky top-24">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 text-center">Score Card</h3>
                <div className="grid grid-cols-1 gap-14">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#f43f5e" />
                  <Gauge value={result.grammarScore} label="Writing Score" color="#10b981" />
                </div>
              </div>

              <div>
                {selectedSegment ? (
                  <div className={`bg-white rounded-[2.5rem] shadow-2xl border-2 p-8 animate-in slide-in-from-right-8 duration-500 ${selectedSegment.type === 'plagiarism' ? 'border-red-500' : 'border-amber-500'}`}>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${selectedSegment.type === 'plagiarism' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {selectedSegment.type === 'plagiarism' ? <AlertCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">
                          {selectedSegment.type === 'plagiarism' ? 'Verified Match' : 'Writing Suggestion'}
                        </h3>
                      </div>
                      <button onClick={() => setSelectedSegment(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-8">
                      <div className={`p-5 rounded-3xl border text-sm font-bold leading-relaxed italic ${selectedSegment.type === 'plagiarism' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                        "{selectedSegment.text}"
                      </div>

                      {selectedSegment.explanation && (
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">AI Context</span>
                          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">{selectedSegment.explanation}</p>
                        </div>
                      )}

                      {selectedSegment.sourceUrl && (
                        <a href={selectedSegment.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2.5 w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all">
                          <ExternalLink className="w-3.5 h-3.5" /> Source Found
                        </a>
                      )}

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Rewrite Alternatives</label>
                        {selectedSegment.suggestions?.map((suggestion, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => replaceSegment(suggestion)}
                            className={`w-full p-5 text-left text-[11px] font-black rounded-2xl border-2 transition-all hover:-translate-y-1 ${selectedSegment.type === 'plagiarism' ? 'hover:bg-red-600 hover:text-white border-red-50' : 'hover:bg-amber-600 hover:text-white border-amber-50'}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-indigo-600 rounded-[2.5rem] shadow-xl p-10 text-center text-white space-y-5">
                    <div className="mx-auto w-16 h-16 bg-white/10 rounded-[1.8rem] flex items-center justify-center backdrop-blur-md border border-white/20">
                      <Lightbulb className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="font-black text-lg tracking-tight">AI Insights</h4>
                    <p className="text-xs text-indigo-100 font-bold leading-relaxed uppercase tracking-widest">
                      Highlights will appear here after analysis.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">
            Optimized for Speed: Gemini 3 Flash
          </p>
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-3 text-[10px] font-black text-red-500 uppercase tracking-widest">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-200"></div> Plagiarism
            </span>
            <span className="flex items-center gap-3 text-[10px] font-black text-amber-500 uppercase tracking-widest">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-200"></div> Grammar
            </span>
          </div>
        </div>
      </footer>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;
