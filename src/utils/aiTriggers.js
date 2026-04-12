const UNCERTAINTY_KEYWORDS = [
  "how do i", "how to", "does anyone know", "what is",
  "can someone help", "im confused", "i'm confused", "im unsure",
  "i'm unsure", "google", "search", "where can i find",
  "whats the", "what's the", "why did"
];

// Memory to avoid spamming the same user/channel
const userCooldowns = new Map();
const channelCooldowns = new Map();
const aiLastSpoke = new Map();

const USER_COOLDOWN_MS = 5 * 60 * 1000; // 5 mins
const CHANNEL_COOLDOWN_MS = 2 * 60 * 1000; // 2 mins
const LISTENING_WINDOW_MS = 60000; // 60 seconds

export function setAIJustSpoke(channelId) {
    aiLastSpoke.set(channelId, Date.now());
}

/**
 * Validates if the bot should trigger the AI response logic.
 * @returns {object} { triggered: boolean, reason: string }
 */
export function shouldTriggerAI(message) {
    if (!message || !message.content) return { triggered: false, reason: 'empty_content' };

    const content = message.content.toLowerCase();
    
    // Priority 1: Direct Engagement
    const isMentioned = message.mentions.has(message.client.user.id);
    const isReplyToBot = message.reference && message.mentions.repliedUser?.id === message.client.user.id;
    
    if (isMentioned || isReplyToBot) {
        return { triggered: true, reason: 'direct' };
    }

    const now = Date.now();
    
    // Priority 1.5: Conversational Continuation (Listening Window)
    const lastSpokeTime = aiLastSpoke.get(message.channel.id) || 0;
    if (now - lastSpokeTime < LISTENING_WINDOW_MS) {
        // Gojo just spoke here. He will reply to the very next message, then stop listening ambiently.
        aiLastSpoke.set(message.channel.id, 0); 
        return { triggered: true, reason: 'conversational' };
    }

    // Check Cooldowns for ambient triggers
    const lastUserTime = userCooldowns.get(message.author.id) || 0;
    const lastChannelTime = channelCooldowns.get(message.channel.id) || 0;

    if (now - lastUserTime < USER_COOLDOWN_MS || now - lastChannelTime < CHANNEL_COOLDOWN_MS) {
        return { triggered: false, reason: 'cooldown' };
    }

    // Priority 2: Uncertainty Keywords
    const hasUncertainty = UNCERTAINTY_KEYWORDS.some(phrase => content.includes(phrase));
    if (hasUncertainty) {
        userCooldowns.set(message.author.id, now);
        channelCooldowns.set(message.channel.id, now);
        return { triggered: true, reason: 'uncertainty' };
    }

    // Priority 3: Lurker Probability (15%)
    if (Math.random() < 0.15) {
        userCooldowns.set(message.author.id, now);
        channelCooldowns.set(message.channel.id, now);
        return { triggered: true, reason: 'probabilistic' };
    }

    return { triggered: false, reason: 'none' };
}
