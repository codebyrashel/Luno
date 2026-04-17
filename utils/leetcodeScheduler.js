const fs = require("fs");

function ensureDataFolder() {
    const dataDir = "./data";
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log("Created data folder");
    }
    return dataDir;
}

function loadLeetcodeSettings(leetcodeService) {
    ensureDataFolder();
    try {
        const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
        const settings = JSON.parse(data);
        
        for (const [guildId, setting] of Object.entries(settings)) {
            leetcodeService.setDailyChannel(guildId, setting.channelId);
        }
        console.log("Loaded LeetCode settings from data folder");
    } catch (error) {
        console.log("No saved LeetCode settings found in data folder");
    }
}

function saveLeetcodeSettings(guildId, channelId) {
    ensureDataFolder();
    let leetcodeSettings = {};
    try {
        const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
        leetcodeSettings = JSON.parse(data);
    } catch (error) {
        // File doesn't exist yet
    }
    
    leetcodeSettings[guildId] = {
        guildId: guildId,
        channelId: channelId,
        enabled: true
    };
    fs.writeFileSync("./data/leetcodeSettings.json", JSON.stringify(leetcodeSettings, null, 2));
}

function removeLeetcodeSettings(guildId) {
    ensureDataFolder();
    let leetcodeSettings = {};
    try {
        const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
        leetcodeSettings = JSON.parse(data);
    } catch (error) {
        // File doesn't exist yet
    }
    
    delete leetcodeSettings[guildId];
    fs.writeFileSync("./data/leetcodeSettings.json", JSON.stringify(leetcodeSettings, null, 2));
}

function scheduleDailyChallenge(client, leetcodeService) {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
    );
    
    const msUntilMidnight = night.getTime() - now.getTime();
    
    setTimeout(() => {
        sendDailyChallengesToAllGuilds(client, leetcodeService);
        setInterval(() => sendDailyChallengesToAllGuilds(client, leetcodeService), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    console.log(`Daily challenge scheduled for ${night.toString()}`);
}

async function sendDailyChallengesToAllGuilds(client, leetcodeService) {
    console.log("Sending daily LeetCode challenges...");
    
    for (const [guildId, setting] of leetcodeService.settings) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(setting.channelId);
            if (!channel) continue;
            
            await leetcodeService.sendDailyChallenge(channel);
            console.log(`Sent daily challenge to guild ${guildId}`);
        } catch (error) {
            console.error(`Failed to send daily challenge to guild ${guildId}:`, error);
        }
    }
}

module.exports = {
    loadLeetcodeSettings,
    saveLeetcodeSettings,
    removeLeetcodeSettings,
    scheduleDailyChallenge
};