
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search, ShieldCheck, AlertCircle, RefreshCcw, ExternalLink, X, 
  Upload, Download, Loader2, ListTree, Lightbulb, 
  CheckCircle2, ArrowRight, Quote, Cpu, Wand2
} from 'lucide-react';
import { analyzeText } from './geminiService';
import { AnalysisResult, AnalysisStatus, TextSegment } from './types';
import { Gauge } from './components/Gauge';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Worker initialization
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const LOADING_STEPS = ["Scanning Web Index...", "Verifying Grammar...", "Detecting AI Influence...", "Generating Citations..."];

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<TextSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (status === AnalysisStatus.ANALYZING) {
      interval = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_STEPS.length), 2500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleAnalyze = async () => {
    if (inputText.trim().length < 20) {
      setError("Please provide a longer text (min 20 chars).");
      return;
    }
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    try {
      const data = await analyzeText(inputText);
      setResult(data);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message === "MISSING_API_KEY" ? "API Key is missing in environment variables." : "Failed to analyze document.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const extractFile = useCallback(async (file: File) => {
    setIsExtracting(true);
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
        setInputText(await file.text());
      }
    } catch { setError("Failed to read file."); }
    finally { setIsExtracting(false); }
  }, []);

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(22); doc.text("VerifyAI Integrity Report", 20, 25);
    doc.setFontSize(10); doc.text(`Score: ${100 - result.plagiarismPercentage}% Originality`, 20, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40);
    const content = result.segments.map(s => s.text).join('');
    doc.text(doc.splitTextToSize(content, 170), 20, 55);
    doc.save("VerifyAI_Report.pdf");
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 font-sans">
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => window.location.reload()}>
          <ShieldCheck className="text-indigo-600" /> Verify<span className="text-indigo-600">AI</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-12">
        {status !== AnalysisStatus.SUCCESS ? (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-tight text-slate-900">Ensure Writing Perfection.</h1>
              <p className="text-slate-500 text-lg">AI-powered plagiarism check, grammar correction, and citation engine.</p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center bg-white hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all group"
            >
              <input type="file" ref={fileInputRef} hidden onChange={e => e.target.files?.[0] && extractFile(e.target.files[0])} />
              {isExtracting ? <Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" /> : <Upload className="mx-auto text-slate-300 mb-4 group-hover:text-indigo-400 transition-colors" />}
              <p className="font-bold text-slate-600">Upload PDF or Text File</p>
              <p className="text-xs text-slate-400 mt-1">Maximum file size: 10MB</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
              <textarea 
                className="w-full h-80 p-8 text-lg font-serif outline-none resize-none leading-relaxed"
                placeholder="Paste your content here to begin the audit..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
              />
              <div className="p-6 bg-slate-50 border-t flex justify-center">
                <button 
                  onClick={handleAnalyze}
                  disabled={status === AnalysisStatus.ANALYZING}
                  className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                >
                  {status === AnalysisStatus.ANALYZING ? <Loader2 className="animate-spin w-5" /> : <Search className="w-5" />}
                  {status === AnalysisStatus.ANALYZING ? LOADING_STEPS[loadingStep] : "Analyze Integrity"}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 p-5 rounded-2xl border border-rose-100 flex gap-3 animate-shake">
                <AlertCircle className="shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </div>
        ) : result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-500">
            <div className="lg:col-span-8 bg-white rounded-3xl p-10 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-10 border-b border-slate-50 pb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Audit Report</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Deep Scan Results</p>
                </div>
                <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                  <Download className="w-4" /> Export PDF
                </button>
              </div>
              <div className="prose prose-slate max-w-none text-xl leading-relaxed font-serif text-slate-800">
                {result.segments.map((seg, i) => (
                  <span 
                    key={i} 
                    // React 19 Ref Assignment Fix
                    ref={(el) => { segmentRefs.current[i] = el; }}
                    onClick={() => seg.type !== 'original' && setSelectedSegment(seg)}
                    className={`rounded px-0.5 cursor-pointer border-b-2 transition-all ${
                      seg.type === 'plagiarism' ? 'bg-rose-50 border-rose-300' : 
                      seg.type === 'grammar' ? 'bg-amber-50 border-amber-300' : 'border-transparent'
                    } ${selectedSegment === seg ? 'ring-4 ring-indigo-500/10 bg-indigo-50' : ''}`}
                  >
                    {seg.text}
                  </span>
                ))}
              </div>

              {result.citations.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-50">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Quote className="w-4 h-4" /> Recommended Citations
                  </h3>
                  <div className="space-y-3">
                    {result.citations.map((cite, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 font-mono border border-slate-100 italic">
                        {cite}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <Gauge value={result.plagiarismPercentage} label="Similarity" color="#f43f5e" />
                  <Gauge value={result.grammarScore} label="Grammar" color="#10b981" />
                </div>
                
                <div className="pt-6 border-t border-slate-50 space-y-5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Check</span>
                    </div>
                    <span className="text-sm font-black text-slate-700">{result.aiLikelihood}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Style</span>
                    </div>
                    <span className="text-sm font-black text-slate-700">{result.writingTone}</span>
                  </div>
                </div>
              </div>

              {selectedSegment ? (
                <div className="bg-white border-2 border-indigo-500 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Suggestion</span>
                    <X className="w-5 h-5 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setSelectedSegment(null)} />
                  </div>
                  <p className="text-sm italic text-slate-500 mb-6 border-l-4 border-indigo-100 pl-4">"{selectedSegment.text}"</p>
                  
                  {selectedSegment.explanation && <p className="text-sm font-semibold text-slate-700 mb-6">{selectedSegment.explanation}</p>}
                  
                  {selectedSegment.sourceUrl && (
                    <a href={selectedSegment.sourceUrl} target="_blank" className="flex items-center gap-2 justify-center w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold mb-6 hover:bg-slate-800 transition-colors">
                      <ExternalLink className="w-4" /> Source Reference
                    </a>
                  )}

                  <div className="space-y-3">
                    {selectedSegment.suggestions?.map((s, i) => (
                      <button 
                        key={i} 
                        onClick={() => {
                          const newSegs = result.segments.map(seg => seg === selectedSegment ? {...seg, text: s, type: 'original' as const} : seg);
                          setResult({...result, segments: newSegs}); 
                          setSelectedSegment(null);
                        }}
                        className="w-full text-left p-4 text-xs font-bold border border-slate-100 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all group"
                      >
                        <span className="flex items-center justify-between">
                          {s}
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><ListTree className="w-5 h-5" /> Navigation</h3>
                  <div className="space-y-2">
                    {result.subtopics.map((t, i) => (
                      <button 
                        key={i} 
                        onClick={() => segmentRefs.current[t.segmentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} 
                        className="w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors truncate"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                  <div className="mt-8 p-4 bg-white/10 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Pro Tip</p>
                    <p className="text-xs mt-1 leading-relaxed">Click on any highlighted text to see detailed explanations and smart rewrites.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-100 mt-20 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Powered by Gemini 3 Deep Grounding Engine</p>
      </footer>
    </div>
  );
};

export default App;
