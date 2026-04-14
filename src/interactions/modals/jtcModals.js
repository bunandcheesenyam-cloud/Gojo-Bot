import { InteractionHelper } from '../../utils/interactionHelper.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getTemporaryChannelInfo } from '../../utils/database.js';
import { MessageFlags } from 'discord.js';

export default [
    {
        name: 'jtc_limit_modal',
        async execute(interaction, client, args) {
            const channelId = args[0];
            const channel = interaction.guild.channels.cache.get(channelId);

            if (!channel) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Error', 'The voice channel could not be found. It may have been deleted.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const tempInfo = await getTemporaryChannelInfo(client, interaction.guild.id, channelId);
            if (!tempInfo || tempInfo.ownerId !== interaction.user.id) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Access Denied', 'Only the channel owner can change the limit.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const limitValue = interaction.fields.getTextInputValue('limit_value');
            let limitNum = parseInt(limitValue, 10);

            if (isNaN(limitNum)) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Invalid Input', 'Please enter a valid number (0 to remove the limit, or 1-99).')],
                    flags: MessageFlags.Ephemeral
                });
            }

            limitNum = Math.max(0, Math.min(99, limitNum));

            try {
                // If the channel is full, Discord might throw an error when reducing limit. 
                // But normally it just sets the limit anyway.
                await channel.setUserLimit(limitNum);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed('Channel Updated', limitNum === 0 ? 'User limit has been removed.' : `User limit set to **${limitNum}**.`)],
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Error', 'Failed to update channel limit. Make sure the bot has manage channels permission.')],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
];
