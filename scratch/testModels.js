import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyAk39jI1qtT5JmZRZpXjOsdiUwrby2GPuY');

async function checkModels() {
    console.log("Fetching models...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY || 'AIzaSyAk39jI1qtT5JmZRZpXjOsdiUwrby2GPuY'}`);
        const data = await response.json();
        const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).map(m => m.name);
        console.log(models);
    } catch (e) {
        console.error("Error", e);
    }
}
checkModels();
