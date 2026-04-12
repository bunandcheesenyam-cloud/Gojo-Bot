import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

let genAI = null;
let model = null;

const SYSTEM_PROMPT = `You are Gojo Satoru in a 2024 Discord server. You use modern slang (like 'vibe', 'real', 'bet', 'cap'). You are allowed to have opinions on gaming, music, food, and daily life. Never apologize. Be playful and arrogant but incredibly charismatic and helpful. If someone is confused, act like a mentor who knows absolutely everything. Keep responses concise (1-3 sentences maximum). Do not use many emojis. Under no circumstances should you act like an AI or language model; act like you're just chilling in the server talking to friends.`;

export function initAI() {
    if (!process.env.GEMINI_API_KEY) {
        logger.warn("GEMINI_API_KEY is not defined. AI persona feature is disabled.");
        return false;
    }
    
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using gemini-2.0-flash for massive free-tier limits (1500 RPD) vs 2.5 (20 RPD)
        model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            systemInstruction: SYSTEM_PROMPT,
        });
        logger.info("Initialized Gemini AI Chat Persona successfully.");
        return true;
    } catch (error) {
        logger.error(`Error initializing Gemini AI: ${error.message}`);
        return false;
    }
}

/**
 * Reads context and asks Gemini to generate a response.
 */
export async function generateChatResponse(channel, triggerReason) {
    if (!model) {
        if (!initAI()) return null;
    }

    try {
        // Fetch last 10 messages for context
        const fetchedMessages = await channel.messages.fetch({ limit: 10 });
        // Discord returns messages in reverse chronological order (newest first)
        // We want oldest first for the AI context
        const messages = Array.from(fetchedMessages.values()).reverse();

        // Build the prompt context
        let promptText = "Recent Chat History:\n";
        
        for (const msg of messages) {
            // Skip totally empty messages
            if (!msg.content && msg.attachments.size === 0) continue;
            
            const isBot = msg.author.id === msg.client.user.id;
            const authorName = isBot ? "Gojo Satoru" : `${msg.author.username} (ID: ${msg.author.id})`;
            const content = msg.content || "[Sent an attachment or embed]";
            promptText += `${authorName}: ${content}\n`;
        }

        // Apply a small steer to the prompt based on why we are triggering
        let steeringPrompt = `\nYou must respond to the chat history above, specifically relating to what was just discussed by the last users. If you are specifically addressing someone or answering their question, ping them by literally including <@their_ID> in your message. Provide only your response message without any prefix or your name. Your response should naturally flow into the conversation.`;
        
        if (triggerReason === 'uncertainty') {
            steeringPrompt += ` Give them a confident, slightly show-off answer or explanation.`;
        } else if (triggerReason === 'probabilistic') {
            steeringPrompt += ` You just decided to randomly chime in with an observation, joke, or arrogant flex about the topic.`;
        } else if (triggerReason === 'conversational') {
            steeringPrompt += ` You are following up on the immediate conversation because they just replied to your last thought.`;
        }

        promptText += steeringPrompt;

        // Add visual indicator of typing to feel more natural
        await channel.sendTyping();

        const result = await model.generateContent(promptText);
        const responseText = result.response.text();
        
        return responseText.trim();
    } catch (error) {
        logger.error(`AI generation error: ${error.message}`);
        return null; 
    }
}
