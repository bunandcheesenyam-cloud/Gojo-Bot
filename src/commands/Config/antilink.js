import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { updateGuildConfig, getGuildConfig } from '../../services/guildConfig.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Configure the Anti-Link Spam module')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcmd => 
            subcmd
                .setName('toggle')
                .setDescription('Toggle the Anti-Link Spam protection on or off')
                .addBooleanOption(opt => 
                    opt.setName('enabled')
                    .setDescription('Enable or disable the module')
                    .setRequired(true)
                )
        )
        .addSubcommand(subcmd => 
            subcmd
                .setName('timeout')
                .setDescription('Set the timeout duration for link spammers')
                .addIntegerOption(opt => 
                    opt.setName('duration')
                    .setDescription('Timeout duration in hours')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(24)
                )
        ),
    category: 'Config',
    async execute(interaction, guildConfig, client) {
        await InteractionHelper.safeDefer(interaction);

        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            await updateGuildConfig(client, interaction.guildId, { antiLinkSpamEnabled: enabled });
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(`Anti-Link Spam protection has been **${enabled ? 'enabled' : 'disabled'}**.`)]
            });
        } 
        else if (subcommand === 'timeout') {
            const hours = interaction.options.getInteger('duration');
            const ms = hours * 60 * 60 * 1000;
            await updateGuildConfig(client, interaction.guildId, { antiLinkSpamTimeoutMs: ms });
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(`AutoMod link spam timeout has been successfully set to **${hours} hour(s)**.`)]
            });
        }
    }
};
