
export interface TextSegment {
  text: string;
  type: 'original' | 'plagiarism' | 'grammar';
  suggestions?: string[];
  sourceUrl?: string;
  explanation?: string;
  citation?: string;
}

export interface Subtopic {
  title: string;
  segmentIndex: number;
}

export interface AnalysisResult {
  plagiarismPercentage: number;
  grammarScore: number;
  aiLikelihood: number;
  writingTone: string;
  overallSummary: string;
  subtopics: Subtopic[];
  segments: TextSegment[];
  citations: string[];
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
