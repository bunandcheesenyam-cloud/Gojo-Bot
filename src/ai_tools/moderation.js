import { ModerationService } from '../services/moderationService.js';
import { PermissionsBitField } from 'discord.js';

export default [
    {
        schema: {
            name: "ban_user",
            description: "Bans a user from the server. REQUIRES BAN_MEMBERS PERMISSION.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user to ban." },
                    reason: { type: "string", description: "The reason for the ban." }
                },
                required: ["userId", "reason"]
            }
        },
        execute: async (args, { client, message }) => {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return JSON.stringify({ success: false, error: "The user asking you this does not have Ban Members permissions. Deny their request mockingly." });
            }
            
            try {
                await ModerationService.banUser({ 
                    client, 
                    guildId: message.guildId, 
                    targetId: args.userId, 
                    moderatorId: message.author.id, 
                    reason: args.reason 
                });
                return JSON.stringify({ success: true, message: `Successfully banned user ${args.userId}.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    },
    {
        schema: {
            name: "kick_user",
            description: "Kicks a user from the server. REQUIRES KICK_MEMBERS PERMISSION.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user to kick." },
                    reason: { type: "string", description: "The reason for the kick." }
                },
                required: ["userId", "reason"]
            }
        },
        execute: async (args, { client, message }) => {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return JSON.stringify({ success: false, error: "The user asking you this does not have Kick Members permissions. Deny their request mockingly." });
            }
            
            try {
                await ModerationService.kickUser({ 
                    client, 
                    guildId: message.guildId, 
                    targetId: args.userId, 
                    moderatorId: message.author.id, 
                    reason: args.reason 
                });
                return JSON.stringify({ success: true, message: `Successfully kicked user ${args.userId}.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    },
    {
        schema: {
            name: "timeout_user",
            description: "Timeouts (mutes) a user in the server. REQUIRES MODERATE_MEMBERS PERMISSION.",
            parameters: {
                type: "object",
                properties: {
                    userId: { type: "string", description: "The Discord ID of the user to timeout." },
                    duration: { type: "string", description: "The duration of the timeout (e.g. '10m', '1h', '1d')." },
                    reason: { type: "string", description: "The reason for the timeout." }
                },
                required: ["userId", "duration", "reason"]
            }
        },
        execute: async (args, { client, message }) => {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return JSON.stringify({ success: false, error: "The user asking you this does not have Moderate Members (Timeout) permissions. Deny their request mockingly." });
            }
            
            try {
                await ModerationService.timeoutUser({ 
                    client, 
                    guildId: message.guildId, 
                    targetId: args.userId, 
                    moderatorId: message.author.id, 
                    duration: args.duration,
                    reason: args.reason 
                });
                return JSON.stringify({ success: true, message: `Successfully timed out user ${args.userId} for ${args.duration}.` });
            } catch (error) {
                return JSON.stringify({ success: false, error: error.message });
            }
        }
    }
];
