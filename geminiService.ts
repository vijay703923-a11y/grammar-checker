
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
    1. Plagiarism: Use Google Search to find matches. If matches are found, provide the URL and the percentage of similarity.
    2. Grammar & Clarity: Identify errors and provide better alternatives.
    3. Writing Style: Identify the tone (e.g., Professional, Academic, Casual).
    4. AI Likelihood: Estimate if the text was AI-generated (0-100).
    5. Citations: Generate APA style citations for any external sources identified.

    OUTPUT FORMAT:
    You must return ONLY a raw JSON object. Do not include markdown formatting like \`\`\`json.
    Ensure "segments" reconstruct the ENTIRE input text exactly, piece by piece.
    Set segment type to 'plagiarism' only if a specific web source matches.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this content for plagiarism and grammar. Focus on web grounding:\n\n${text.substring(0, 15000)}`,
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

    // Handle potential markdown formatting in response
    let cleanText = response.text || "{}";
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanText) as AnalysisResult;
    
    // Map Search URLs from grounding metadata for added reliability
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      const urls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      let urlIdx = 0;
      parsed.segments = parsed.segments.map(seg => {
        if (seg.type === 'plagiarism' && !seg.sourceUrl && urls.length > 0) {
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
    if (error.message?.includes("API_KEY")) throw new Error("MISSING_API_KEY");
    throw new Error("Analysis engine failed. Ensure your text is clear and try again.");
  }
};
