import { logger } from '../utils/logger.js';
import { getLevelingConfig, getXpForLevel, getUserLevelData, saveUserLevelData, MAX_LEVEL } from './leveling.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';






export async function processVoiceXP(client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      const config = await getLevelingConfig(client, guild.id);
      if (!config || !config.enabled) continue;
      
      const voiceStates = guild.voiceStates.cache;
      for (const [memberId, voiceState] of voiceStates) {
        if (voiceState.member && !voiceState.member.user.bot && voiceState.channelId) {
          // Skip if they are in the AFK channel
          if (guild.afkChannelId && voiceState.channelId === guild.afkChannelId) continue;
          
          // Optionally, skip if they are deafened (uncomment if desired)
          // if (voiceState.selfDeaf || voiceState.serverDeaf) continue;

          await addXp(client, guild, voiceState.member, 10);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing voice XP:', error);
  }
}


export async function addXp(client, guild, member, xpToAdd) {
  try {
    
    if (!xpToAdd || xpToAdd <= 0) {
      return { success: false, reason: 'Invalid XP amount' };
    }

    const config = await getLevelingConfig(client, guild.id);
    
    if (!config.enabled) {
      return { success: false, reason: 'Leveling is disabled in this server' };
    }
    
    const levelData = await getUserLevelData(client, guild.id, member.user.id);
    
    levelData.xp += xpToAdd;
    levelData.totalXp += xpToAdd;
    levelData.lastMessage = Date.now();
    
    if (levelData.level >= MAX_LEVEL) {
      levelData.level = MAX_LEVEL;
      await saveUserLevelData(client, guild.id, member.user.id, levelData);
      return {
        success: true,
        level: levelData.level,
        xp: levelData.xp,
        totalXp: levelData.totalXp,
        xpNeeded: 0,
        leveledUp: false
      };
    }
    
    const xpNeededForNextLevel = getXpForLevel(levelData.level + 1);
    let didLevelUp = false;
    
    
    if (levelData.xp >= xpNeededForNextLevel) {
      levelData.level += 1;
      levelData.xp = levelData.xp - xpNeededForNextLevel;
      didLevelUp = true;
      
      logger.info(`🎉 ${member.user.tag} leveled up to level ${levelData.level} in ${guild.name}`);
      
      
      if (config.roleRewards && config.roleRewards[levelData.level]) {
        await awardRoleReward(guild, member, config.roleRewards[levelData.level], levelData.level);
      }
      
      
      if (config.announceLevelUp) {
        await sendLevelUpAnnouncement(guild, member, levelData, config);
      }

      
      try {
        await logEvent({
          client,
          guildId: guild.id,
          eventType: EVENT_TYPES.LEVELING_LEVELUP,
          data: {
            description: `${member.user.tag} reached level ${levelData.level}`,
            userId: member.user.id,
            fields: [
              {
                name: '👤 Member',
                value: `${member.user.tag} (${member.user.id})`,
                inline: true
              },
              {
                name: '📊 New Level',
                value: levelData.level.toString(),
                inline: true
              },
              {
                name: '✨ Total XP',
                value: levelData.totalXp.toString(),
                inline: true
              }
            ]
          }
        });
      } catch {
      }
    }
    
    await saveUserLevelData(client, guild.id, member.user.id, levelData);
    
    return {
      success: true,
      level: levelData.level,
      xp: levelData.xp,
      totalXp: levelData.totalXp,
      xpNeeded: getXpForLevel(levelData.level + 1),
      leveledUp: didLevelUp
    };
    
  } catch (error) {
    logger.error('Error adding XP:', error);
    return { success: false, error: error.message };
  }
}










async function awardRoleReward(guild, member, roleId, level) {
  try {
    const role = guild.roles.cache.get(roleId);
    
    if (!role) {
      logger.warn(`Role ${roleId} not found for level ${level} reward in guild ${guild.id}`);
      return;
    }

    
    if (member.roles.cache.has(roleId)) {
      return;
    }

    await member.roles.add(role, `Level ${level} reward`);
    logger.info(`✅ Awarded role ${role.name} to ${member.user.tag} for reaching level ${level}`);
  } catch (error) {
    logger.error(`Failed to award role reward to ${member.user.id}:`, error);
  }
}










async function sendLevelUpAnnouncement(guild, member, levelData, config) {
  try {
    const levelUpChannel = config.levelUpChannel 
      ? guild.channels.cache.get(config.levelUpChannel) 
      : guild.systemChannel;
    
    if (!levelUpChannel || !levelUpChannel.isTextBased()) {
      return;
    }

    
    const permissions = levelUpChannel.permissionsFor(guild.members.me);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.warn(`Missing permissions to send levelup message in ${levelUpChannel.id}`);
      return;
    }

    let roleText = 'Sorcerer';
    
    // Check if there is a role reward for this specific level
    const newRoleId = config.roleRewards && config.roleRewards[levelData.level];
    if (newRoleId) {
      const role = guild.roles.cache.get(newRoleId);
      if (role) roleText = role.name;
    } else if (config.roleRewards) {
      // Find the highest role reward they currently have
      const existingRewardLevels = Object.keys(config.roleRewards)
        .map(Number)
        .filter(lvl => lvl <= levelData.level)
        .sort((a, b) => b - a);
        
      if (existingRewardLevels.length > 0) {
        const highestRoleId = config.roleRewards[existingRewardLevels[0]];
        const highestRole = guild.roles.cache.get(highestRoleId);
        if (highestRole) roleText = highestRole.name;
      }
    }

    const message = config.levelUpMessage
      .replace(/{user}/g, member.toString())
      .replace(/{level}/g, levelData.level)
      .replace(/{xp}/g, levelData.xp)
      .replace(/{xpNeeded}/g, getXpForLevel(levelData.level + 1))
      .replace(/{role}/g, roleText);
    
    await levelUpChannel.send(message).catch(error => {
      logger.error(`Failed to send level up message in channel ${levelUpChannel.id}:`, error);
    });
  } catch (error) {
    logger.error('Error sending level up announcement:', error);
  }
}


