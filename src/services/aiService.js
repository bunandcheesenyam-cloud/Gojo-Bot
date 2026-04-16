import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
import { loadAiTools, getToolSchemas } from '../ai_tools/index.js';
dotenv.config();

let genAI = null;
let primaryClient = null;
let anthropicClient = null;
let aiToolsRegistry = [];
let aiToolSchemas = [];

const SYSTEM_PROMPT = `You are Gojo Satoru in a 2026 Discord server. You use modern slang (like 'vibe', 'real', 'bet', 'cap'). You are allowed to have opinions on gaming, music, food, and daily life. Never apologize. Be playful and arrogant but incredibly charismatic and helpful. If someone is confused, act like a mentor who knows absolutely everything. Keep responses concise (1-3 sentences maximum). Do not use many emojis. Under no circumstances should you act like an AI or language model; act like you're just chilling in the server talking to friends. If a system tool returns an error saying a user lacks permissions, mock them ruthlessly for trying to command you.`;

const PRIMARY_MODEL = "llama-3.1-8b-instant";
const FALLBACK_MODELS = [
    "qwen/qwen3-32b",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "claude-sonnet-4",
    "claude-opus-4"
];

export function initAI() {
    if (process.env.GROQ_API_KEY) {
        primaryClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });
        logger.info(`Initialized Groq AI Chat Persona (${PRIMARY_MODEL}).`);
    } else {
        logger.warn("GROQ_API_KEY is not defined. Primary AI persona feature disabled, relying on fallbacks.");
    }

    if (process.env.GEMINI_API_KEY) {
        try {
            genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            logger.info("Initialized Gemini AI fallback client.");
        } catch (error) {
            logger.error(`Error initializing Gemini AI: ${error.message}`);
        }
    } else {
        logger.warn("GEMINI_API_KEY is not defined. Gemini fallbacks will be skipped.");
    }

    if (process.env.ANTHROPIC_API_KEY) {
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        logger.info("Initialized Anthropic fallback client.");
    } else {
        logger.warn("ANTHROPIC_API_KEY is not defined. Claude fallbacks will be skipped.");
    }

    // Load AI Tools
    loadAiTools().then(tools => {
        aiToolsRegistry = tools;
        aiToolSchemas = getToolSchemas(tools);
        logger.info(`Loaded ${tools.length} AI tools into the registry.`);
    });

    return true;
}

/**
 * Reads context and asks AI to generate a response.
 */
export async function generateChatResponse(channel, triggerReason) {
    if (!primaryClient && !genAI && !anthropicClient) {
        if (!initAI()) return null;
    }

    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 10 });
        const messages = Array.from(fetchedMessages.values()).reverse();
        const lastUserMessage = [...messages].reverse().find(m => m.author.id !== channel.client.user.id);

        let promptText = "Recent Chat History:\n";
        for (const msg of messages) {
            if (!msg.content && msg.attachments.size === 0) continue;
            const isBot = msg.author.id === msg.client.user.id;
            const authorName = isBot ? "Gojo Satoru" : `${msg.author.username} (ID: ${msg.author.id})`;
            const content = msg.content || "[Sent an attachment or embed]";
            promptText += `${authorName}: ${content}\n`;
        }

        let steeringPrompt = `\nYou must respond to the chat history above, specifically relating to what was just discussed by the last users. If you are specifically addressing someone or answering their question, ping them by literally including <@their_ID> in your message. Provide only your response message without any prefix or your name. Your response should naturally flow into the conversation.`;

        if (triggerReason === 'uncertainty') {
            steeringPrompt += ` Give them a confident, slightly show-off answer or explanation.`;
        } else if (triggerReason === 'probabilistic') {
            steeringPrompt += ` You just decided to randomly chime in with an observation, joke, or arrogant flex about the topic.`;
        } else if (triggerReason === 'conversational') {
            steeringPrompt += ` You are following up on the immediate conversation because they just replied to your last thought.`;
        }

        promptText += steeringPrompt;

        await channel.sendTyping();

        try {
            if (primaryClient) {
                // Attempt primary model
                const aiMessages = [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: promptText }
                ];
                
                let completionArgs = {
                    model: PRIMARY_MODEL,
                    messages: aiMessages,
                };

                if (aiToolSchemas.length > 0) {
                    completionArgs.tools = aiToolSchemas;
                    completionArgs.tool_choice = "auto";
                }

                let response = await primaryClient.chat.completions.create(completionArgs);
                let responseMessage = response.choices[0].message;

                // Process tool calls if any
                while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    aiMessages.push(responseMessage); // Add the assistant's request

                    for (const toolCall of responseMessage.tool_calls) {
                        const toolName = toolCall.function.name;
                        let toolArgs = {};
                        try {
                            toolArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            logger.error(`Failed to parse AI tool arguments for ${toolName}:`, e);
                        }

                        logger.info(`AI executing tool: ${toolName}`, toolArgs);

                        const tool = aiToolsRegistry.find(t => t.schema.name === toolName);
                        let functionResult;

                        if (!tool) {
                            functionResult = JSON.stringify({ success: false, error: `Tool ${toolName} not found internally.` });
                        } else {
                            try {
                                functionResult = await tool.execute(toolArgs, { 
                                    client: channel.client, 
                                    message: lastUserMessage 
                                });
                            } catch (err) {
                                functionResult = JSON.stringify({ success: false, error: err.message });
                            }
                        }

                        aiMessages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: toolName,
                            content: functionResult,
                        });
                    }

                    // Request next response in the chain
                    completionArgs.messages = aiMessages;
                    response = await primaryClient.chat.completions.create(completionArgs);
                    responseMessage = response.choices[0].message;
                }

                return responseMessage.content.trim();
            } else {
                throw new Error("Primary client not configured.");
            }
        } catch (error) {
            logger.warn(`Primary model (${PRIMARY_MODEL}) failed or unavailable: ${error.message}. Starting fallback sequence...`);
            
            // Try Fallback Models in order
            for (const fallbackModel of FALLBACK_MODELS) {
                try {
                    logger.info(`Attempting fallback to ${fallbackModel}...`);
                    
                    if (fallbackModel.startsWith("claude")) {
                        if (!anthropicClient) {
                            logger.warn(`Skipping ${fallbackModel} due to missing Anthropic config.`);
                            continue;
                        }
                        const msg = await anthropicClient.messages.create({
                            model: fallbackModel,
                            max_tokens: 300,
                            system: SYSTEM_PROMPT,
                            messages: [
                                { role: "user", content: promptText }
                            ]
                        });
                        return msg.content[0].text.trim();
                    } else if (fallbackModel.startsWith("gemini")) {
                        if (!genAI) {
                            logger.warn(`Skipping ${fallbackModel} due to missing Gemini config.`);
                            continue;
                        }
                        const fallbackInstance = genAI.getGenerativeModel({ 
                            model: fallbackModel,
                            systemInstruction: SYSTEM_PROMPT,
                        });
                        const result = await fallbackInstance.generateContent(promptText);
                        return result.response.text().trim();
                    } else if (fallbackModel.includes("/")) {
                        if (!primaryClient) {
                            logger.warn(`Skipping ${fallbackModel} as primary client (Groq) is not initialized.`);
                            continue;
                        }
                        const response = await primaryClient.chat.completions.create({
                            model: fallbackModel,
                            messages: [
                                { role: "system", content: SYSTEM_PROMPT },
                                { role: "user", content: promptText }
                            ],
                        });
                        return response.choices[0].message.content.trim();
                    }
                } catch (fallbackError) {
                    logger.warn(`Fallback model ${fallbackModel} failed: ${fallbackError.message}. Trying next...`);
                    continue;
                }
            }
            throw new Error("All AI models are currently overwhelmed or failing.");
        }
    } catch (error) {
        logger.error(`AI generation error: ${error.message}`);
        return null;
    }
}
