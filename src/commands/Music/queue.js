import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import botConfig from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue.'),
    async execute(interaction, guildConfig, client) {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ There is no music playing right now.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(botConfig.embeds.colors.primary)
            .setTitle(`Queue for ${interaction.guild.name}`);

        const current = player.queue.current;
        embed.addFields({ name: '🔘 Now Playing', value: `[${current.title}](${current.uri}) - <@${current.requester.id}>` });

        if (player.queue.length > 0) {
            const tracks = player.queue.slice(0, 10);
            const mapping = tracks.map((t, i) => `${i + 1}. [${t.title}](${t.uri}) - <@${t.requester.id}>`).join('\n');
            embed.addFields({ name: `Up Next (${player.queue.length} left)`, value: mapping });
        } else {
            embed.addFields({ name: 'Up Next', value: 'There are no songs left in the queue.' });
        }

        return interaction.reply({ embeds: [embed] });
    }
};
