import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "./types";

export const analyzeText = async (text: string): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("AI Service Configuration Missing: Please set the API_KEY environment variable in your deployment dashboard.");
  }

  // Flash model is significantly faster than Pro for analysis tasks
  const ai = new GoogleGenAI({ apiKey });
  
  const systemPrompt = `
    You are a high-speed academic integrity engine. 
    Task: Analyze the text for plagiarism (using Google Search), grammar, and quality.
    
    Output Requirements:
    - MUST return ONLY a JSON object.
    - 'segments' must reconstruct the original text exactly.
    - Provide 2-3 high-quality rewrite suggestions for flagged parts.
    
    JSON Schema:
    {
      "plagiarismPercentage": number,
      "grammarScore": number,
      "overallSummary": "string",
      "subtopics": [{ "title": "string", "segmentIndex": number }],
      "segments": [{
        "text": "original text",
        "type": "original" | "plagiarism" | "grammar",
        "suggestions": ["string"],
        "sourceUrl": "URL",
        "explanation": "why flagged"
      }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Changed from pro to flash for speed
      contents: `Analyze: "${text.substring(0, 10000)}"`, // Limit input slightly for faster context processing
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
        temperature: 0.2, // Lower temperature for faster, more consistent JSON
      },
    });

    const resultText = response.text || "";
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Format Error: The AI response was interrupted.");

    const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Fast URL extraction
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const urls = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter(Boolean);
      
      if (urls.length > 0) {
        const uniqueUrls = Array.from(new Set(urls)) as string[];
        parsed.overallSummary += "\n\nVerified Sources:\n" + uniqueUrls.map(u => `- ${u}`).join("\n");
      }
    }

    return parsed;
  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw error;
  }
};
