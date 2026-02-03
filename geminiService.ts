
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, Type } from "./types";

export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  // Creating a new instance per call as per guidelines for key selection (though process.env.API_KEY is standard here)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const systemPrompt = `
    You are an elite academic integrity and writing enhancement engine. 
    
    TASK:
    1. Analyze the input text for potential plagiarism using Google Search grounding.
    2. Identify grammar, style, and clarity issues.
    3. Calculate an overall plagiarism percentage (0-100).
    4. Calculate a grammar/writing score (0-100).
    5. Segment the text into parts to identify specifically where issues occur.
    
    OUTPUT FORMAT:
    Return ONLY a JSON object. Ensure the 'segments' array, when joined, reconstructs the input text perfectly.
    
    SCHEMA:
    {
      "plagiarismPercentage": number,
      "grammarScore": number,
      "overallSummary": "string",
      "subtopics": [{ "title": "string", "segmentIndex": number }],
      "segments": [{
        "text": "the exact text part",
        "type": "original" | "plagiarism" | "grammar",
        "suggestions": ["suggestion 1", "suggestion 2"],
        "explanation": "brief reason for flag",
        "sourceUrl": "URL if plagiarism"
      }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: `Please analyze this document text: \n\n${text.substring(0, 12000)}` }] }],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Low temperature for high consistency in JSON output
      },
    });

    const resultText = response.text || "";
    // Robust JSON extraction
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("The AI provided an invalid response format. Please try again.");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Extract grounding URLs and assign them to plagiarized segments if the model didn't provide specific ones
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      const urls = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter(Boolean) as string[];
      
      if (urls.length > 0) {
        // Find segments marked as plagiarism that don't have URLs and assign from the chunks
        let urlIdx = 0;
        parsed.segments = parsed.segments.map(seg => {
          if (seg.type === 'plagiarism' && !seg.sourceUrl && urls[urlIdx]) {
            const updated = { ...seg, sourceUrl: urls[urlIdx] };
            urlIdx = (urlIdx + 1) % urls.length;
            return updated;
          }
          return seg;
        });
        
        const uniqueUrls = Array.from(new Set(urls));
        parsed.overallSummary += `\n\nPotential sources identified: ${uniqueUrls.length}`;
      }
    }

    return parsed;
  } catch (error: any) {
    console.error("Analysis Error:", error);
    if (error.message?.includes("API_KEY") || error.message?.includes("not found")) {
      throw new Error("Authentication failed. Please ensure the AI service is properly configured.");
    }
    throw new Error(error.message || "An unexpected error occurred during analysis.");
  }
};
