import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractMeterReading(base64Image: string): Promise<number | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1] || base64Image,
              },
            },
            {
              text: "Extract the numeric reading from this water meter image. Return only the number, no text. If you can't find a number, return 'null'.",
            },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text || text.toLowerCase() === "null") return null;
    
    const number = parseFloat(text.replace(/[^0-9.]/g, ""));
    return isNaN(number) ? null : number;
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
}
