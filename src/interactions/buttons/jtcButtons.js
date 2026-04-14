import { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } from 'discord.js';
import { getTemporaryChannelInfo } from '../../utils/database.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

export default [
    {
        name: 'jtc_private',
        async execute(interaction, client) {
            const channel = interaction.channel;
            const tempInfo = await getTemporaryChannelInfo(client, interaction.guild.id, channel.id);
            
            if (!tempInfo || tempInfo.ownerId !== interaction.user.id) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Access Denied', 'Only the channel owner can use this control panel.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const everyoneRole = interaction.guild.roles.everyone;
            const permissions = channel.permissionsFor(everyoneRole);
            const isPrivate = !permissions.has(PermissionFlagsBits.Connect);

            try {
                await channel.permissionOverwrites.edit(everyoneRole.id, {
                    Connect: isPrivate ? null : false // null restores default, false denies
                });

                // If making private, optionally disconnect everyone who isn't the owner?
                // The user asked about this. For now, we just stop new people from joining.

                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed(isPrivate ? 'Channel Unlocked' : 'Channel Locked', isPrivate ? 'Anyone can join the channel now.' : 'Your channel is now private.')],
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Error', 'Failed to update channel privacy.')],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },
    {
        name: 'jtc_limit',
        async execute(interaction, client) {
            const channel = interaction.channel;
            const tempInfo = await getTemporaryChannelInfo(client, interaction.guild.id, channel.id);
            
            if (!tempInfo || tempInfo.ownerId !== interaction.user.id) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Access Denied', 'Only the channel owner can use this control panel.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`jtc_limit_modal:${channel.id}`)
                .setTitle('Set User Limit');

            const limitInput = new TextInputBuilder()
                .setCustomId('limit_value')
                .setLabel('User Limit (0 to remove limit)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(2)
                .setPlaceholder('e.g., 5');

            const firstActionRow = new ActionRowBuilder().addComponents(limitInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        }
    },
    {
        name: 'jtc_add_user',
        async execute(interaction, client) {
            const channel = interaction.channel;
            const tempInfo = await getTemporaryChannelInfo(client, interaction.guild.id, channel.id);
            
            if (!tempInfo || tempInfo.ownerId !== interaction.user.id) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Access Denied', 'Only the channel owner can use this control panel.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const userSelect = new UserSelectMenuBuilder()
                .setCustomId(`jtc_select_user:${channel.id}`)
                .setPlaceholder('Select a user to grant access...')
                .setMinValues(1)
                .setMaxValues(5);

            const row = new ActionRowBuilder().addComponents(userSelect);

            return InteractionHelper.safeReply(interaction, {
                content: 'Select users from the menu below to grant them access to this channel:',
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }
    }
];
