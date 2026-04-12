import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import botConfig from '../../config/bot.js';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song from YouTube, Spotify, or SoundCloud.')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('The song name or URL to play.')
                .setRequired(true)
        ),
    async execute(interaction, guildConfig, client) {
        await interaction.deferReply();

        const { channel } = interaction.member.voice;
        if (!channel) {
            const embed = new EmbedBuilder()
                .setColor(botConfig.embeds.colors.error)
                .setDescription('❌ You must be in a voice channel to use this command.');
            return interaction.editReply({ embeds: [embed] });
        }

        const query = interaction.options.getString('query');
        
        let player = client.manager.players.get(interaction.guild.id);
        if (!player) {
            player = client.manager.create({
                guild: interaction.guild.id,
                voiceChannel: channel.id,
                textChannel: interaction.channel.id,
                volume: 100,
                selfDeafen: true
            });
        }

        if (player.state !== 'CONNECTED') player.connect();

        try {
            const res = await client.manager.search(query, interaction.user);
            
            if (res.loadType === 'empty' || res.loadType === 'NO_MATCHES') {
                return interaction.editReply('❌ No results found for that query.');
            }
            if (res.loadType === 'error' || res.loadType === 'LOAD_FAILED') {
                return interaction.editReply('❌ An error occurred while searching for the track.');
            }

            if (res.loadType === 'playlist' || res.loadType === 'PLAYLIST_LOADED') {
                for (const track of res.tracks) player.queue.add(track);
                
                if (!player.playing && !player.paused && player.queue.size === res.tracks.length) {
                    player.play();
                }
                
                const embed = new EmbedBuilder()
                    .setColor(botConfig.embeds.colors.primary)
                    .setTitle('🎶 Playlist Added to Queue')
                    .setDescription(`Added **${res.tracks.length}** tracks from playlist \`${res.playlistData?.name || 'Unknown'}\`.`);
                return interaction.editReply({ embeds: [embed] });
            } else {
                const track = res.tracks[0];
                player.queue.add(track);
                
                if (!player.playing && !player.paused && !player.queue.size) {
                    player.play();
                }
                
                const embed = new EmbedBuilder()
                    .setColor(botConfig.embeds.colors.success)
                    .setTitle('✅ Added to Queue')
                    .setDescription(`[${track.title}](${track.uri})`);
                return interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            return interaction.editReply(`❌ Error playing track: ${err.message}`);
        }
    }
};
