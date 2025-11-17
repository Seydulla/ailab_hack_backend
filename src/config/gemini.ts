import { GoogleGenAI } from '@google/genai';
import { env } from './env';

const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export default genAI;
