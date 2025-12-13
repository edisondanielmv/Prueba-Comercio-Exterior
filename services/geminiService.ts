import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { RAW_QUESTION_BANK } from "../data/rawQuestions";

/**
 * Parses the entire raw question bank (200 questions) into structured objects.
 * This runs locally to ensure we have the full pool of questions available.
 */
const parseFullBankLocal = (): Question[] => {
    const questions: Question[] = [];
    
    // Split by regex that looks for newline followed by number and dot (e.g. "\n1.")
    // We filter out small blocks to avoid empty splits.
    const blocks = RAW_QUESTION_BANK.split(/\n\d+\./).filter(b => b.trim().length > 10);
    
    blocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        
        let questionTextLines: string[] = [];
        const options: string[] = [];
        let correctIndex = -1;
        let parsingOptions = false;

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return;

            // Check if it's an option start like "A)" or "A."
            const optionMatch = cleanLine.match(/^([A-D])[).]/);
            if (optionMatch) {
                parsingOptions = true;
                // Remove the "A)" prefix to get clean text
                const optionText = cleanLine.substring(optionMatch[0].length).trim();
                options.push(optionText);
            }
            // Match "Respuesta correcta: B" or similar
            else if (cleanLine.toLowerCase().includes('respuesta correcta:')) {
                const parts = cleanLine.split(':');
                if (parts.length > 1) {
                    const char = parts[1].trim().toLowerCase();
                    // Convert 'a'->0, 'b'->1, etc.
                    if (char.length >= 1) {
                        const code = char.charCodeAt(0);
                        if (code >= 97 && code <= 100) { // a-d
                             correctIndex = code - 97;
                        }
                    }
                }
            }
            // If it's not an option and not the answer line, it's part of the question text/context
            else if (!parsingOptions) {
                questionTextLines.push(cleanLine);
            }
        });

        const fullText = questionTextLines.join(' ');

        // Ensure we have 4 options and a valid answer
        if (options.length === 4 && correctIndex >= 0 && correctIndex <= 3) {
            questions.push({
                // We use the index from the raw bank temporarily, but this will be re-indexed later
                id: index, 
                text: fullText,
                options,
                correctOptionIndex: correctIndex
            });
        }
    });

    return questions;
};

export const generateExamQuestions = async (): Promise<Question[]> => {
    // 1. Parse the FULL bank of 200 questions locally
    const allQuestions = parseFullBankLocal();

    // 2. Randomly select 30 UNIQUE questions from the 200 available.
    // This ensures every student gets a different exam subset.
    const selectedQuestions = allQuestions
        .sort(() => 0.5 - Math.random()) // Shuffle full bank
        .slice(0, 30) // Take first 30
        .map((q, idx) => ({ ...q, id: idx + 1 })); // Re-index 1 to 30

    // 3. Try to use Gemini to rephrase these specific 30 questions
    try {
        if (!process.env.API_KEY) {
            console.warn("No API Key found, using local random selection.");
            return selectedQuestions;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
        You are an expert academic examiner in International Trade.
        
        I have selected 30 specific questions for a student's exam. Your task is to process these questions to prevent cheating while ensuring clarity.
        
        INSTRUCTIONS FOR EACH QUESTION:
        1.  **Rephrase the 'text'**: Rewrite the question scenario and context. 
            *   **CRITICAL**: You MUST PRESERVE ALL DETAILS, case study facts, numbers, and context required to answer. Do not summarize or shorten the question. Make it extensive if necessary to be clear.
            *   Goal: Make the text different from the original so it cannot be found easily with "CTRL+F", but keep the meaning identical.
        2.  **Shuffle 'options'**: Randomize the order of the 4 options (A, B, C, D).
        3.  **Update 'correctOptionIndex'**: Ensure the correct answer index (0-3) matches the new position of the correct option.
        4.  **Language**: Strictly Spanish.
        
        INPUT DATA (JSON):
        ${JSON.stringify(selectedQuestions)}
        
        OUTPUT:
        Return ONLY the JSON array of the processed questions.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            text: { type: Type.STRING, description: "The extensive rephrased question text." },
                            options: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING } 
                            },
                            correctOptionIndex: { type: Type.INTEGER }
                        },
                        required: ["id", "text", "options", "correctOptionIndex"]
                    }
                }
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text);
            if (Array.isArray(data) && data.length > 0) {
                return data as Question[];
            }
        }
        
        throw new Error("Invalid API response format");

    } catch (error) {
        console.error("Gemini API failed or key missing, falling back to local random selection.", error);
        // Fallback: Return the 30 locally selected unique questions (without rephrasing)
        return selectedQuestions;
    }
};