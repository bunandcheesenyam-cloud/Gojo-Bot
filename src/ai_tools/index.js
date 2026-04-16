import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadAiTools() {
    const tools = [];
    const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.js') && file !== 'index.js');

    for (const file of files) {
        try {
            const module = await import(`file://${path.join(__dirname, file)}`);
            if (module.default && Array.isArray(module.default)) {
                tools.push(...module.default);
            }
        } catch (error) {
            console.error(`[AI Tools] Error loading tool file ${file}:`, error);
        }
    }
    return tools;
}

export function getToolSchemas(tools) {
    return tools.map(tool => ({
        type: "function",
        function: tool.schema
    }));
}
