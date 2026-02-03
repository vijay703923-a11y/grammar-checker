
export interface TextSegment {
  text: string;
  type: 'original' | 'plagiarism' | 'grammar';
  suggestions?: string[];
  sourceUrl?: string;
  explanation?: string;
}

export interface Subtopic {
  title: string;
  segmentIndex: number;
}

export interface AnalysisResult {
  plagiarismPercentage: number;
  grammarScore: number;
  segments: TextSegment[];
  overallSummary: string;
  subtopics: Subtopic[];
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
