
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, Type } from "./types";

export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY || process.env.API_KEY === "undefined") {
    throw new Error("MISSING_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
    You are an elite academic integrity engine. 
    Analyze the provided text for:
    1. Plagiarism: Use Google Search to find matches.
    2. Grammar & Clarity: Fix errors.
    3. Writing Style: Identify tone.
    4. AI Likelihood: Estimate AI generation (0-100).
    5. Citations: Generate APA style citations for sources.

    IMPORTANT: 
    - Output must be valid JSON.
    - Segments must reconstruct the full input text.
    - Use grounding metadata for URLs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this content for plagiarism and grammar:\n\n${text.substring(0, 15000)}`,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plagiarismPercentage: { type: Type.NUMBER },
            grammarScore: { type: Type.NUMBER },
            aiLikelihood: { type: Type.NUMBER },
            writingTone: { type: Type.STRING },
            overallSummary: { type: Type.STRING },
            subtopics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  segmentIndex: { type: Type.INTEGER }
                },
                required: ["title", "segmentIndex"]
              }
            },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  type: { type: Type.STRING },
                  suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  explanation: { type: Type.STRING },
                  sourceUrl: { type: Type.STRING },
                  citation: { type: Type.STRING }
                },
                required: ["text", "type"]
              }
            },
            citations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["plagiarismPercentage", "grammarScore", "aiLikelihood", "writingTone", "segments", "citations"]
        }
      },
    });

    const parsed = JSON.parse(response.text || "{}") as AnalysisResult;
    
    // Map Search URLs
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      const urls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      let urlIdx = 0;
      parsed.segments = parsed.segments.map(seg => {
        if (seg.type === 'plagiarism' && !seg.sourceUrl && urls[urlIdx]) {
          const u = urls[urlIdx];
          urlIdx = (urlIdx + 1) % urls.length;
          return { ...seg, sourceUrl: u };
        }
        return seg;
      });
    }

    return parsed;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.status === 403 ? "MISSING_API_KEY" : "Analysis engine failed. Please try again.");
  }
};
