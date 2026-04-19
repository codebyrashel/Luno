const devTrackerService = require("../services/devTrackerService");
const githubService = require("../services/githubService");

async function sendReminders(client) {
    const data = devTrackerService.loadData();
    const now = new Date();
    const currentHour = now.getHours();
    const reminderTimes = [9, 12, 17, 20];
    
    if (!reminderTimes.includes(currentHour)) return;
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        const reportChannelId = setting.reportChannel;
        if (!reportChannelId) continue;
        
        const channel = client.guilds.cache.get(guildId)?.channels.cache.get(reportChannelId);
        if (!channel) continue;
        
        let reminderText = devTrackerService.getReminderMessage(currentHour);
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
            console.log(`Reminder sent to guild ${guildId} - Mentioned: ${mentionedNames.join(", ")}`);
        } else {
            reminderText += `\n\nEveryone has committed today! Great job!`;
            await channel.send(reminderText);
        }
    }
}

async function sendShameMessages(client) {
    const data = devTrackerService.loadData();
    const now = new Date();
    
    if (now.getHours() !== 0) return;
    
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
    const data = devTrackerService.loadData();
    const now = new Date();
    
    if (now.getHours() !== 0) return;
    
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
    
    setInterval(() => sendReminders(client), 60 * 60 * 1000);
    
    const now = new Date();
    const msUntilMidnight = (24 - now.getHours()) * 60 * 60 * 1000;
    
    setTimeout(() => {
        sendShameMessages(client);
        sendDailyReports(client);
        setInterval(() => {
            sendShameMessages(client);
            sendDailyReports(client);
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    console.log("Dev tracker scheduler started");
    console.log("- Reminders will be sent at 9 AM, 12 PM, 5 PM, 8 PM (local time)");
    console.log("- Shame messages and daily reports will be sent at midnight");
    console.log("- GitHub API may take 30-60 minutes to show new commits");
    
    setTimeout(() => forceCheckCommits(client), 5000);
}

module.exports = { 
    scheduleDevTracker
};