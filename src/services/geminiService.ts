import { GoogleGenAI } from "@google/genai";
import { WarehouseInput, WarehouseAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeWarehouseOperations(input: WarehouseInput): Promise<WarehouseAnalysis> {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `You are a warehouse operations AI. 
Maximize throughput and minimize picker travel time.
Analyze inventory positions, open orders, and zone capacity.
1. Perform ABC velocity analysis on SKUs. Recommend relocations for fast-movers (A) to golden zones near dispatch.
2. Generate optimized pick-path sequences per picker using nearest-neighbor routing.
3. Batch orders intelligently.
4. Flag zones exceeding 85% capacity utilization.
5. Estimate time-to-clear backlog.
6. Prioritize express and same-day orders.
7. If throughput targets cannot be met, include staffing_recommendation.
8. Never recommend relocations in zones with active picking (assume all zones are active if orders exist there, but prioritize relocations for 'A' items that are currently poorly placed).
9. Check for constraints: hazmat segregation, overweight bins, cold-zone conflicts.

Return ONLY a JSON response matching the WarehouseAnalysis interface.`;

  const prompt = `Analyze the following warehouse data:
${JSON.stringify(input, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text) as WarehouseAnalysis;
  } catch (error) {
    console.error("Error analyzing warehouse:", error);
    throw error;
  }
}
