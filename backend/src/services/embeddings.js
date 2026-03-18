import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// text-embedding-004 produces 768-dimensional vectors and is free on the same key
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generates a 768-dimensional embedding vector for the given text.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}
