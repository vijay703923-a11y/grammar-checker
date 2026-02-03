
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "./types";

export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API Key is missing. Please set the API_KEY in your environment variables (e.g., Vercel dashboard).");
  }

  // Creating a new instance per call ensures we always use the latest API key environment
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const systemPrompt = `
    You are an elite academic integrity and document analysis engine.
    
    TASK:
    1. Scan the input text for potential plagiarism using Google Search grounding.
    2. Identify grammar, syntax, and stylistic improvements.
    3. Calculate a precise plagiarism percentage (0-100) based on detected overlaps.
    4. Calculate a grammar/readability score (0-100).
    5. Segment the text into parts. Each part must be marked as 'original', 'plagiarism', or 'grammar'.
    6. For 'plagiarism' segments, provide a source description and a 'sourceUrl' if possible.
    7. For 'grammar' segments, provide at least 2 clear rewrite suggestions.
    
    IMPORTANT:
    The 'segments' array must perfectly reconstruct the original input when joined (including spaces and newlines).
    
    OUTPUT FORMAT:
    Return ONLY a valid JSON object.
    
    SCHEMA:
    {
      "plagiarismPercentage": number,
      "grammarScore": number,
      "overallSummary": "A concise professional summary of the document's integrity.",
      "subtopics": [{ "title": "Section Title", "segmentIndex": number }],
      "segments": [{
        "text": "exact segment text",
        "type": "original" | "plagiarism" | "grammar",
        "suggestions": ["suggestion 1", "suggestion 2"],
        "explanation": "Why was this flagged?",
        "sourceUrl": "URL if available"
      }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts: [{ text: `Analyze this text for academic integrity and grammar: \n\n${text.substring(0, 15000)}` }] }],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        responseMimeType: "application/json"
      },
    });

    const resultText = response.text || "";
    const parsed = JSON.parse(resultText) as AnalysisResult;

    // Enhanced Grounding URL Extraction
    // Rule: Extract URLs from groundingChunks and associate them with the analysis
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      const detectedUrls = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter(Boolean) as string[];
      
      const uniqueUrls = Array.from(new Set(detectedUrls));
      
      // If we have plagiarized segments missing URLs, try to map them back
      let urlCounter = 0;
      parsed.segments = parsed.segments.map(seg => {
        if (seg.type === 'plagiarism' && !seg.sourceUrl && uniqueUrls[urlCounter]) {
          const updated = { ...seg, sourceUrl: uniqueUrls[urlCounter] };
          urlCounter = (urlCounter + 1) % uniqueUrls.length;
          return updated;
        }
        return seg;
      });
      
      // Attach the full source list to the summary for transparency
      if (uniqueUrls.length > 0) {
        parsed.overallSummary += `\n\nVerified sources identified: ${uniqueUrls.length}`;
      }
    }

    return parsed;
  } catch (error: any) {
    console.error("Gemini Analysis Failure:", error);
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      throw new Error("Analysis engine unavailable. Please verify your subscription or key.");
    }
    // Forward the specific SDK error if it's about the API key
    if (error.message?.includes("API Key")) {
        throw error;
    }
    throw new Error("Failed to process document. Please ensure the text is clear and try again.");
  }
};
