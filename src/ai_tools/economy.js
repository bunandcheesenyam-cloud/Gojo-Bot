import EconomyService from '../services/economyService.js';
import { PermissionsBitField } from 'discord.js';

export default [
    {
        schema: {
            name: "add_money",
            description: "Adds money (economy coins) to a user's wallet. REQUIRES ADMIN.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user receiving the money." },
                    amount: { type: "integer", description: "The amount of money to add." }
                },
                required: ["userId", "amount"]
            }
        },
        execute: async (args, { client, message }) => {
            // Security check
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return JSON.stringify({ success: false, error: "The user asking you this does not have Administrator permissions. Deny their request mockingly." });
            }
            
            try {
                const userData = await EconomyService.addMoney(client, message.guildId, args.userId, args.amount, 'ai_tool');
                return JSON.stringify({ success: true, newBalance: userData.wallet, message: `Successfully added ${args.amount} to user.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    },
    {
        schema: {
            name: "remove_money",
            description: "Removes money (economy coins) from a user's wallet. REQUIRES ADMIN.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user losing the money." },
                    amount: { type: "integer", description: "The amount of money to remove." }
                },
                required: ["userId", "amount"]
            }
        },
        execute: async (args, { client, message }) => {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return JSON.stringify({ success: false, error: "The user asking you this does not have Administrator permissions. Deny their request mockingly." });
            }

            try {
                const userData = await EconomyService.removeMoney(client, message.guildId, args.userId, args.amount, 'ai_tool');
                return JSON.stringify({ success: true, newBalance: userData.wallet, message: `Successfully removed ${args.amount} from user.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    }
];
