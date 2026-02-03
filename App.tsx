
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

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const LOADING_STEPS = ["Scanning Web...", "Checking Grammar...", "Analyzing AI Content...", "Finalizing Report..."];

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
      setError("Please provide at least 20 characters.");
      return;
    }
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    try {
      const data = await analyzeText(inputText);
      setResult(data);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message === "MISSING_API_KEY" ? "API Key not configured. Please add API_KEY to environment variables." : "Failed to analyze.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const extractFile = useCallback(async (file: File) => {
    setIsExtracting(true);
    try {
      if (file.type === 'application/pdf') {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
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
    } catch { setError("File read error."); }
    finally { setIsExtracting(false); }
  }, []);

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Integrity Report", 20, 20);
    doc.setFontSize(10); doc.text(`Originality: ${100 - result.plagiarismPercentage}%`, 20, 30);
    doc.text(doc.splitTextToSize(result.segments.map(s => s.text).join(''), 170), 20, 50);
    doc.save("Report.pdf");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="h-16 bg-white border-b px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => window.location.reload()}>
          <ShieldCheck className="text-indigo-600" /> Verify<span className="text-indigo-600">AI</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        {status !== AnalysisStatus.SUCCESS ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black">Secure Writing Integrity.</h1>
              <p className="text-slate-500">Advanced plagiarism and AI detection engine.</p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white hover:border-indigo-500 cursor-pointer transition-all"
            >
              <input type="file" ref={fileInputRef} hidden onChange={e => e.target.files?.[0] && extractFile(e.target.files[0])} />
              {isExtracting ? <Loader2 className="animate-spin mx-auto text-indigo-600" /> : <Upload className="mx-auto text-slate-400 mb-2" />}
              <p className="font-bold">Upload PDF or Text</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border">
              <textarea 
                className="w-full h-80 p-8 text-lg font-serif outline-none resize-none"
                placeholder="Paste content here..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
              />
              <div className="p-6 bg-slate-50 border-t flex justify-center">
                <button 
                  onClick={handleAnalyze}
                  disabled={status === AnalysisStatus.ANALYZING}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {status === AnalysisStatus.ANALYZING ? <Loader2 className="animate-spin w-5" /> : <Search className="w-5" />}
                  {status === AnalysisStatus.ANALYZING ? LOADING_STEPS[loadingStep] : "Start Analysis"}
                </button>
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex gap-2"><AlertCircle /> {error}</div>}
          </div>
        ) : result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white rounded-3xl p-8 border shadow-sm">
              <div className="flex justify-between items-center mb-8 border-b pb-6">
                <h2 className="text-2xl font-bold">Analysis Details</h2>
                <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"><Download className="w-4" /> Export PDF</button>
              </div>
              <div className="prose prose-slate max-w-none text-xl leading-relaxed font-serif">
                {result.segments.map((seg, i) => (
                  <span 
                    key={i} 
                    ref={el => { segmentRefs.current[i] = el; }}
                    onClick={() => seg.type !== 'original' && setSelectedSegment(seg)}
                    className={`rounded px-0.5 cursor-pointer border-b-2 transition-all ${seg.type === 'plagiarism' ? 'bg-rose-50 border-rose-300' : seg.type === 'grammar' ? 'bg-amber-50 border-amber-300' : 'border-transparent'}`}
                  >
                    {seg.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl p-8 border shadow-sm grid grid-cols-2 gap-4">
                <Gauge value={result.plagiarismPercentage} label="Similarity" color="#f43f5e" />
                <Gauge value={result.grammarScore} label="Grammar" color="#10b981" />
                <div className="col-span-2 pt-4 border-t space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">AI Likelihood</span>
                    <span className="font-black">{result.aiLikelihood}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Writing Tone</span>
                    <span className="font-black">{result.writingTone}</span>
                  </div>
                </div>
              </div>

              {selectedSegment ? (
                <div className="bg-white border-2 border-indigo-500 rounded-3xl p-6 shadow-xl animate-in slide-in-from-right-4">
                  <div className="flex justify-between mb-4"><span className="text-[10px] font-black uppercase text-indigo-600">Correction</span><X className="w-4 cursor-pointer" onClick={() => setSelectedSegment(null)} /></div>
                  <p className="text-sm italic text-slate-500 mb-4">"{selectedSegment.text}"</p>
                  {selectedSegment.explanation && <p className="text-sm font-medium mb-4">{selectedSegment.explanation}</p>}
                  {selectedSegment.sourceUrl && <a href={selectedSegment.sourceUrl} target="_blank" className="block text-center py-2 bg-slate-900 text-white rounded-lg text-xs font-bold mb-4">View Source</a>}
                  {selectedSegment.suggestions?.map((s, i) => (
                    <button key={i} className="w-full text-left p-3 text-xs border rounded-xl mb-2 hover:bg-indigo-50 hover:border-indigo-200" onClick={() => {
                      const newSegs = result.segments.map(seg => seg === selectedSegment ? {...seg, text: s, type: 'original' as any} : seg);
                      setResult({...result, segments: newSegs}); setSelectedSegment(null);
                    }}>{s}</button>
                  ))}
                </div>
              ) : (
                <div className="bg-indigo-600 rounded-3xl p-8 text-white">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><ListTree className="w-5" /> Navigation</h3>
                  <div className="space-y-2">
                    {result.subtopics.map((t, i) => (
                      <button key={i} onClick={() => segmentRefs.current[t.segmentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="w-full text-left p-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold truncate">
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
