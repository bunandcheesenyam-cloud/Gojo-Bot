import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import botConfig from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the currently playing song.'),
    async execute(interaction, guildConfig, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ There is no music playing in this server.', ephemeral: true });
        }

        const { channel } = interaction.member.voice;
        if (!channel || channel.id !== player.voiceChannel) {
            return interaction.reply({ content: '❌ You must be in the same voice channel to skip.', ephemeral: true });
        }

        if (!player.queue.current) {
            return interaction.reply({ content: '❌ There is no song currently playing.', ephemeral: true });
        }

        player.stop();

        const embed = new EmbedBuilder()
            .setColor(botConfig.embeds.colors.success)
            .setDescription('⏭️ Skipped the current song.');
        return interaction.reply({ embeds: [embed] });
    }
};
