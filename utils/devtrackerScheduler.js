const devTrackerService = require("../services/devTrackerService");
const githubService = require("../services/githubService");

// Track which reminders have been sent today
let lastReminderDate = null;
let sentRemindersToday = {
    morning: false,
    afternoon: false,
    evening: false,
    night: false,
    midnight: false
};

function resetReminderTracking() {
    const today = new Date().toISOString().split('T')[0];
    if (lastReminderDate !== today) {
        lastReminderDate = today;
        sentRemindersToday = {
            morning: false,
            afternoon: false,
            evening: false,
            night: false,
            midnight: false
        };
        console.log(`[DEBUG] Reminder tracking reset for ${today}`);
    }
}

async function sendReminders(client) {
    resetReminderTracking();
    
    const data = devTrackerService.loadData();
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    const currentUTCMinute = now.getUTCMinutes(); 
    
    // Bangladesh reminder times converted to UTC
    // 9 AM BD = 3 AM UTC (morning)
    // 12 PM BD = 6 AM UTC (afternoon)
    // 5 PM BD = 11 AM UTC (evening)
    // 8 PM BD = 2 PM UTC (night)
    
    let reminderType = null;
    let reminderHourBD = null;
    
    if (currentUTCHour === 3 && currentUTCMinute === 0 && !sentRemindersToday.morning) {
        reminderType = "morning";
        reminderHourBD = 9;
        sentRemindersToday.morning = true;
    } else if (currentUTCHour === 6 && currentUTCMinute === 0 && !sentRemindersToday.afternoon) {
        reminderType = "afternoon";
        reminderHourBD = 12;
        sentRemindersToday.afternoon = true;
    } else if (currentUTCHour === 11 && currentUTCMinute === 0 && !sentRemindersToday.evening) {
        reminderType = "evening";
        reminderHourBD = 17;
        sentRemindersToday.evening = true;
    } else if (currentUTCHour === 14 && currentUTCMinute === 0 && !sentRemindersToday.night) {
        reminderType = "night";
        reminderHourBD = 20;
        sentRemindersToday.night = true;
    }
    
    if (!reminderType) return;
    
    console.log(`[DEBUG] Sending ${reminderType} reminder at UTC ${currentUTCHour}:00 (BD ${reminderHourBD}:00)`);
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        const reportChannelId = setting.reportChannel;
        if (!reportChannelId) continue;
        
        const channel = client.guilds.cache.get(guildId)?.channels.cache.get(reportChannelId);
        if (!channel) continue;
        
        let reminderText = devTrackerService.getReminderMessage(reminderHourBD);
        let mentionedUsers = [];
        let mentionedNames = [];
        
        for (const [userId, userData] of Object.entries(data.users)) {
            if (userData.github) {
                const commitsToday = await githubService.getTodayCommits(userData.github);
                if (commitsToday === 0) {
                    const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
                    if (member) {
                        mentionedUsers.push(`<@${userId}>`);
                        mentionedNames.push(member.displayName);
                    }
                }
            }
        }
        
        if (mentionedUsers.length > 0) {
            reminderText += `\n\nUsers who haven't committed yet:\n${mentionedUsers.join(", ")}`;
            await channel.send(reminderText);
            console.log(`${reminderType} reminder sent to guild ${guildId} - Mentioned: ${mentionedNames.join(", ")}`);
        } else {
            reminderText += `\n\nEveryone has committed today! Great job!`;
            await channel.send(reminderText);
        }
    }
}

async function sendShameMessages(client) {
    resetReminderTracking();
    
    const data = devTrackerService.loadData();
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    const currentUTCMinute = now.getUTCMinutes(); 
    
    // Midnight Bangladesh (12 AM BD) = 6 PM UTC (18:00)
    if (currentUTCHour !== 18 || currentUTCMinute !== 0 || sentRemindersToday.midnight) return;
    
    sentRemindersToday.midnight = true;
    console.log(`[DEBUG] Sending shame messages at UTC ${currentUTCHour}:00 (Bangladesh midnight)`);
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        const reportChannelId = setting.reportChannel;
        if (!reportChannelId) continue;
        
        const channel = client.guilds.cache.get(guildId)?.channels.cache.get(reportChannelId);
        if (!channel) continue;
        
        const shameMessagesList = [];
        
        for (const [userId, userData] of Object.entries(data.users)) {
            if (userData.github) {
                const commitsToday = await githubService.getTodayCommits(userData.github);
                if (commitsToday === 0) {
                    const missedDays = devTrackerService.incrementMissedDays(userId);
                    const shameMessage = devTrackerService.getShameMessage(missedDays);
                    shameMessagesList.push(`<@${userId}> - ${shameMessage}`);
                } else {
                    devTrackerService.resetMissedDays(userId);
                }
            }
        }
        
        if (shameMessagesList.length > 0) {
            const shameText = `** Missed Commit Report **\n\n${shameMessagesList.join("\n\n")}\n\nDon't break your streak tomorrow!`;
            await channel.send(shameText);
            console.log(`Shame messages sent to guild ${guildId} for ${shameMessagesList.length} users`);
        }
    }
}

async function sendDailyReports(client) {
    resetReminderTracking();
    
    const data = devTrackerService.loadData();
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    const currentUTCMinute = now.getUTCMinutes(); 
    
    // Midnight Bangladesh (12 AM BD) = 6 PM UTC (18:00)
    if (currentUTCHour !== 18 || currentUTCMinute !== 0) return;
    
    console.log(`[DEBUG] Sending daily reports at UTC ${currentUTCHour}:00 (Bangladesh midnight)`);
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        const trackerChannelId = setting.trackerChannel;
        if (!trackerChannelId) continue;
        
        const channel = client.guilds.cache.get(guildId)?.channels.cache.get(trackerChannelId);
        if (!channel) continue;
        
        const trackerEntries = [];
        
        for (const [userId, userData] of Object.entries(data.users)) {
            if (userData.github) {
                const commitsToday = await githubService.getTodayCommits(userData.github);
                const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
                
                if (member) {
                    if (commitsToday > 0) {
                        trackerEntries.push(`<@${userId}>: ${commitsToday} commit(s) today. Great job!`);
                    } else {
                        const missedDays = userData.missedDays || 0;
                        trackerEntries.push(`<@${userId}>: No commits today. Missed ${missedDays} day(s) in a row.`);
                    }
                }
            }
        }
        
        if (trackerEntries.length > 0) {
            const trackerText = `** Daily Coding Report **\n\n${trackerEntries.join("\n")}`;
            await channel.send(trackerText);
        } else {
            await channel.send("** Daily Coding Report **\n\nNo registered users active today.");
        }
        console.log(`Daily report sent to guild ${guildId}`);
    }
}

async function forceCheckCommits(client) {
    console.log("Force checking commits...");
    const data = devTrackerService.loadData();
    let foundCommits = false;
    
    for (const [userId, userData] of Object.entries(data.users)) {
        if (userData.github) {
            const commitsToday = await githubService.getTodayCommits(userData.github);
            const member = await client.guilds.cache.get("YOUR_GUILD_ID")?.members.fetch(userId).catch(() => null);
            const name = member ? member.displayName : userId;
            console.log(`User ${name} (${userData.github}): ${commitsToday} commits today`);
            if (commitsToday > 0) {
                foundCommits = true;
            }
        }
    }
    
    if (!foundCommits) {
        console.log("No commits found. GitHub API may be delayed (can take 30-60 minutes).");
    }
}

function scheduleDevTracker(client) {
    console.log("Starting Dev Tracker scheduler...");
    
    // Check every minute for reminders (but will only send once per day per type)
    setInterval(() => sendReminders(client), 60 * 1000);
    setInterval(() => {
        sendShameMessages(client);
        sendDailyReports(client);
    }, 60 * 1000);
    
    console.log("Dev tracker scheduler started");
    console.log("- Reminders will be sent once at 9 AM, 12 PM, 5 PM, 8 PM (Bangladesh Time)");
    console.log("- Shame messages and daily reports will be sent once at midnight (Bangladesh Time)");
    console.log("- Current UTC time: " + new Date().toUTCString());
    
    // setTimeout(() => forceCheckCommits(client), 5000);
}

module.exports = { 
    scheduleDevTracker
};