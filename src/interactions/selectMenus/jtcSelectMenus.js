import { InteractionHelper } from '../../utils/interactionHelper.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getTemporaryChannelInfo } from '../../utils/database.js';
import { MessageFlags } from 'discord.js';

export default [
    {
        name: 'jtc_select_user',
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
                    embeds: [errorEmbed('Access Denied', 'Only the channel owner can grant access.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const selectedUsers = interaction.values;

            try {
                for (const userId of selectedUsers) {
                    await channel.permissionOverwrites.edit(userId, {
                        Connect: true,
                        Speak: true
                    });
                }
                
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed('Access Granted', `Successfully granted ${selectedUsers.length} user(s) explicit access to your channel.`)],
                    flags: MessageFlags.Ephemeral
                });

            } catch (error) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Error', 'Failed to grant access. Make sure the bot has manage channels permission.')],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
];
