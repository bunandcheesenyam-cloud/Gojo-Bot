import { Manager } from "magmastream";
import { logger } from "../utils/logger.js";
import { EmbedBuilder } from "discord.js";
import botConfig from "../config/bot.js";

export function initializeMusicManager(client) {
    const nodes = [
        {
            id: "Railway-Lavalink",
            host: process.env.LAVALINK_HOST || "lavalink-4.railway.internal",
            port: parseInt(process.env.LAVALINK_PORT || "8080"),
            password: process.env.LAVALINK_PASSWORD || "retro",
            secure: process.env.LAVALINK_SECURE === "true" || false,
        }
    ];

    client.manager = new Manager({
        nodes,
        send: (id, payload) => {
            const guild = client.guilds.cache.get(id);
            if (guild) guild.shard.send(payload);
        },
        defaultSearchPlatform: "ytsearch",
    });

    client.manager.on("nodeConnect", node => {
        logger.info(`[Music] Node ${node.id} connected successfully to Lavalink!`);
    });

    client.manager.on("nodeError", (node, error) => {
        logger.error(`[Music] Node ${node.id} had an error: ${error.message}`);
    });

    client.manager.on("trackStart", (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(botConfig.embeds.colors.primary)
                .setTitle("🎶 Now Playing")
                .setDescription(`[${track.title}](${track.uri})`)
                .addFields({ name: "Requested By", value: track.requester ? `<@${track.requester.id}>` : "Unknown" })
                .setTimestamp();
                
            channel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    client.manager.on("queueEnd", player => {
        const channel = client.channels.cache.get(player.textChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(botConfig.embeds.colors.warning)
                .setDescription("Queue concluded. Disconnecting from voice channel.");
            channel.send({ embeds: [embed] }).catch(() => {});
        }
        player.destroy();
    });

    return client.manager;
}
