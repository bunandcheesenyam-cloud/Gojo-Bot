import { MessageFlags } from 'discord.js';
import { setConfigValue } from '../../../services/guildConfig.js';
import { successEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.deferReply(interaction, true);

        try {
            const enable = interaction.options.getBoolean("enable") ?? true;

            await setConfigValue(client, interaction.guild.id, "aiChatEnabled", enable);

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "AI Persona Toggled",
                        `The AI Contextual Chat persona has been ${
                            enable ? "enabled" : "disabled"
                        } for this server.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            logger.error("Error setting AI config:", error);
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Database Error",
                        "Failed to update the AI Persona settings in the database.",
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
