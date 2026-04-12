import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import botConfig from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Changes the music volume.')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The volume percentage (1-200)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(200)
        ),
    async execute(interaction, guildConfig, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ There is no music playing right now.', ephemeral: true });
        }

        const { channel } = interaction.member.voice;
        if (!channel || channel.id !== player.voiceChannel) {
            return interaction.reply({ content: '❌ You must be in the same voice channel to change the volume.', ephemeral: true });
        }

        const volume = interaction.options.getInteger('amount');
        player.setVolume(volume);

        const embed = new EmbedBuilder()
            .setColor(botConfig.embeds.colors.success)
            .setDescription(`🔊 Volume set to **${volume}%**`);
        return interaction.reply({ embeds: [embed] });
    }
};
