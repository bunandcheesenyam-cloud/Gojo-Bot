




import { Events, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { shouldTriggerAI, setAIJustSpoke } from '../utils/aiTriggers.js';
import { generateChatResponse } from '../services/aiService.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      
      if (message.author.bot || !message.guild) return;

      const wasDeleted = await handleAntiLinkSpam(message, client);
      if (wasDeleted) return;

      // Handle Gojo Persona AI Chat
      const aiTrigger = shouldTriggerAI(message);
      if (aiTrigger.triggered) {
          handleAIChat(message, aiTrigger.reason).catch(e => logger.error(`AI Chat failed: ${e}`));
      }

      await handleLeveling(message, client);
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

const userLinkMemory = new Map();
const LINK_SPAM_WINDOW_MS = 60000; 

async function handleAntiLinkSpam(message, client) {
  try {
    if (!message.content) return false;
    
    // Fetch configuration
    const config = await getGuildConfig(client, message.guild.id).catch(() => ({}));
    const isEnabled = config.antiLinkSpamEnabled ?? true;
    const timeoutMs = config.antiLinkSpamTimeoutMs ?? 3600000;
    
    if (!isEnabled) return false;
    
    if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return false;
    }

    
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const linksFound = message.content.match(urlRegex);
    
    if (!linksFound || linksFound.length === 0) return false;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const memoryKey = `${guildId}-${userId}`;
    const now = Date.now();

    if (!userLinkMemory.has(memoryKey)) {
        userLinkMemory.set(memoryKey, []);
    }
    
    let history = userLinkMemory.get(memoryKey);
    history = history.filter(item => now - item.timestamp < LINK_SPAM_WINDOW_MS);

    for (const link of linksFound) {
        
        const previousOccurrence = history.find(item => item.link.toLowerCase() === link.toLowerCase());

        if (previousOccurrence) {
            
            try {
                
                await message.delete().catch(() => {});
                
                
                try {
                    const prevChannel = message.guild.channels.cache.get(previousOccurrence.channelId);
                    if (prevChannel) {
                        const prevMsg = await prevChannel.messages.fetch(previousOccurrence.messageId).catch(() => null);
                        if (prevMsg) await prevMsg.delete().catch(() => {});
                    }
                } catch (e) {
                    
                }

                
                if (message.member && message.member.moderatable) {
                    await message.member.timeout(timeoutMs, "Automod: Link spamming").catch(() => {});
                }

                const timeoutHours = Math.round(timeoutMs / (60 * 60 * 1000) * 10) / 10;
                logger.info(`Automod: Timed out ${message.author.tag} for ${timeoutHours} hour(s) for spamming link: ${link}`);

                
                const warningMsg = await message.channel.send({
                  content: `⚠️ ${message.author.toString()} has been timed out for ${timeoutHours} hour(s) and their messages removed for spamming links.`,
                  allowedMentions: { users: [message.author.id] }
                }).catch(() => null);
                
                if (warningMsg) {
                  setTimeout(() => {
                      warningMsg.delete().catch(() => {});
                  }, 7000);
                }
                
                
                userLinkMemory.set(memoryKey, []);
                return true; 
                
            } catch (error) {
                logger.warn(`Automod error handling link spam for ${message.author.tag}: ${error.message}`);
                return false;
            }
        } else {
            
            history.push({
                link: link,
                timestamp: now,
                messageId: message.id,
                channelId: message.channel.id
            });
        }
    }
    
    userLinkMemory.set(memoryKey, history);
    return false;
    
  } catch (error) {
    logger.warn(`Failed to process anti-link spam for ${message.author.tag}:`, error.message);
    return false;
  }
}








async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) {
      return;
    }

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    
    if (!levelingConfig?.enabled) {
      return;
    }

    
    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    
    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => {
        return null;
      });
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) {
        return;
      }
    }

    
    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) {
      return;
    }

    
    if ((!message.content || message.content.trim().length === 0) && message.attachments.size === 0) {
      return;
    }

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);
    
    
    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLastMessage = now - (userData.lastMessage || 0);
    
    
    if (timeSinceLastMessage < cooldownTime * 1000) {
      return;
    }

    
    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;

    
    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);

    
    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    
    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    // +5 XP Image/Meme/War-Logs Bonus
    if (message.attachments.size > 0 || message.content.match(/https?:\/\//i)) {
      finalXP += 5;
    }

    
    const result = await addXp(client, message.guild, message.member, finalXP);
    
    if (result.success && result.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}

async function handleAIChat(message, triggerReason) {
    // Generate AI response with context
    const response = await generateChatResponse(message.channel, triggerReason);
    if (response) {
        // Send directly to channel to feel more like a real person
        await message.channel.send(response).then(() => {
            setAIJustSpoke(message.channel.id);
        }).catch(err => {
            logger.warn(`Failed to send AI response in ${message.channel.id}: ${err.message}`);
        });
    }
}



