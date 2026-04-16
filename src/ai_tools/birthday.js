import { setBirthday, getUserBirthday } from '../services/birthdayService.js';

export default [
    {
        schema: {
            name: "set_birthday",
            description: "Sets or updates a user's birthday.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user. MUST BE A STRING WRAPPED IN QUOTES." },
                    month: { type: "integer", description: "The month of the birthday (1-12)." },
                    day: { type: "integer", description: "The day of the birthday (1-31)." }
                },
                required: ["userId", "month", "day"]
            }
        },
        execute: async (args, { client, message }) => {
            // A user can only set their own birthday, unless they are an admin
            if (args.userId !== message.author.id) {
                const { PermissionsBitField } = require('discord.js');
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return JSON.stringify({ success: false, error: "Users can only set their own birthdays unless they have Administrator permissions." });
                }
            }
            
            try {
                const result = await setBirthday(client, message.guildId, args.userId, args.month, args.day);
                return JSON.stringify({ success: true, message: `Successfully set birthday to ${result.data.monthName} ${args.day}.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    },
    {
        schema: {
            name: "get_birthday",
            description: "Gets a user's birthday.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user. MUST BE A STRING WRAPPED IN QUOTES." }
                },
                required: ["userId"]
            }
        },
        execute: async (args, { client, message }) => {
            try {
                const result = await getUserBirthday(client, message.guildId, args.userId);
                if (!result) return JSON.stringify({ success: true, message: "This user has not set a birthday." });
                return JSON.stringify({ success: true, birthday: `${result.monthName} ${result.day}` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    }
];
