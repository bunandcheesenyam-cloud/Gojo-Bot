import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import botConfig from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and disconnects the bot.'),
    async execute(interaction, guildConfig, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ There is no music playing in this server.', ephemeral: true });
        }

        const { channel } = interaction.member.voice;
        if (!channel || channel.id !== player.voiceChannel) {
            return interaction.reply({ content: '❌ You must be in the same voice channel to stop the music.', ephemeral: true });
        }

        player.destroy();

        const embed = new EmbedBuilder()
            .setColor(botConfig.embeds.colors.error)
            .setDescription('🛑 Music stopped and queue cleared.');
        return interaction.reply({ embeds: [embed] });
    }
};
