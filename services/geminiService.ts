import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateOpponent = async (playerLevel: number): Promise<{ name: string; carName: string; taunt: string } | null> => {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a fictional street racer opponent for a drag racing game. The player level is ${playerLevel} (1-10 scale). 
      Return a JSON object with:
      - name: Cool street racer name (max 15 chars)
      - carName: Fictional car model name (max 15 chars)
      - taunt: A short, aggressive but PG race taunt (max 60 chars)
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            carName: { type: Type.STRING },
            taunt: { type: Type.STRING },
          },
          required: ["name", "carName", "taunt"]
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error generating opponent:", error);
    return null;
  }
};
