const devTrackerService = require("../services/devTrackerService");
const githubService = require("../services/githubService");
const codeforcesService = require("../services/codeforcesService");

async function sendReminders(client) {
    console.log("Sending developer reminders...");
    
    const data = devTrackerService.loadData();
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        try {
            const reminderHour = setting.reminderHour || 20;
            const reminderTimes = [9, 12, 17, reminderHour];
            
            if (!reminderTimes.includes(currentHour)) continue;
            
            if (devTrackerService.wasReminderSent(guildId, today, currentHour)) continue;
            
            const reportChannelId = setting.reportChannel;
            if (!reportChannelId) continue;
            
            const channel = client.guilds.cache.get(guildId)?.channels.cache.get(reportChannelId);
            if (!channel) continue;
            
            let reminderText = devTrackerService.getReminderMessage(currentHour);
            let mentionedUsers = [];
            
            for (const [userId, userData] of Object.entries(data.users)) {
                if (userData.github) {
                    const commitsToday = await githubService.getTodayCommits(userData.github);
                    if (commitsToday === 0) {
                        const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
                        if (member) {
                            mentionedUsers.push(`<@${userId}>`);
                        }
                    }
                }
            }
            
            if (mentionedUsers.length > 0) {
                reminderText += `\n\nUsers who haven't committed yet:\n${mentionedUsers.join(", ")}`;
            }
            
            await channel.send(reminderText);
            devTrackerService.recordReminderSent(guildId, today, currentHour);
            
        } catch (error) {
            console.error(`Failed to send reminders to guild ${guildId}:`, error);
        }
    }
}

async function checkMissedCommits(client) {
    console.log("Checking for missed commits...");
    
    const data = devTrackerService.loadData();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (now.getHours() !== 0) return;
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        try {
            const reportChannelId = setting.reportChannel;
            const trackerChannelId = setting.trackerChannel;
            
            const reportChannel = reportChannelId ? client.guilds.cache.get(guildId)?.channels.cache.get(reportChannelId) : null;
            const trackerChannel = trackerChannelId ? client.guilds.cache.get(guildId)?.channels.cache.get(trackerChannelId) : null;
            
            let shameMessages = [];
            let trackerEntries = [];
            
            for (const [userId, userData] of Object.entries(data.users)) {
                if (userData.github) {
                    const commitsToday = await githubService.getTodayCommits(userData.github);
                    const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
                    
                    if (commitsToday === 0 && member) {
                        const missedDays = devTrackerService.incrementMissedDays(userId);
                        const shameMessage = devTrackerService.getShameMessage(missedDays);
                        shameMessages.push(`<@${userId}> - ${shameMessage}`);
                        trackerEntries.push(`${member.displayName}: No commits today. Missed ${missedDays} day(s) in a row.`);
                    } else if (member) {
                        devTrackerService.resetMissedDays(userId);
                        trackerEntries.push(`${member.displayName}: ${commitsToday} commit(s) today. Great job!`);
                    }
                }
            }
            
            if (shameMessages.length > 0 && reportChannel) {
                const shameText = `[ Missed Commit Report ]\n\n${shameMessages.join("\n\n")}\n\nDon't break your streak tomorrow!`;
                await reportChannel.send(shameText);
            }
            
            if (trackerEntries.length > 0 && trackerChannel) {
                const trackerText = `[ Daily Coding Report ]\n\n${trackerEntries.join("\n")}`;
                await trackerChannel.send(trackerText);
            }
            
            devTrackerService.clearReminders(guildId, today);
            
        } catch (error) {
            console.error(`Failed to check missed commits for guild ${guildId}:`, error);
        }
    }
}

async function sendDailyReports(client) {
    console.log("Sending daily developer reports...");
    
    const data = devTrackerService.loadData();
    
    for (const [guildId, setting] of Object.entries(data.settings)) {
        try {
            const trackerChannelId = setting.trackerChannel;
            if (!trackerChannelId) continue;
            
            const trackerChannel = client.guilds.cache.get(guildId)?.channels.cache.get(trackerChannelId);
            if (!trackerChannel) continue;
            
            let report = "[ Daily Developer Report ]\n\n";
            let hasAnyActivity = false;
            
            for (const [userId, userData] of Object.entries(data.users)) {
                const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
                if (!member) continue;
                
                const stats = await devTrackerService.fetchUserStats(userId, userData);
                const hasActivity = stats.github.commitsToday > 0 || stats.codeforces.solvedToday > 0;
                
                if (hasActivity) {
                    hasAnyActivity = true;
                    report += `${member.displayName}:\n`;
                    if (stats.github.commitsToday > 0) {
                        report += `- ${stats.github.commitsToday} GitHub commit(s)\n`;
                    }
                    if (stats.codeforces.solvedToday > 0) {
                        report += `- ${stats.codeforces.solvedToday} Codeforces problem(s)\n`;
                    }
                    report += `- Streak: ${stats.github.streak} days\n\n`;
                }
            }
            
            if (hasAnyActivity) {
                report += "Keep up the great work!";
                await trackerChannel.send(report);
            } else {
                await trackerChannel.send("[ Daily Developer Report ]\nNo coding activity recorded today. Time to get started!");
            }
            
            console.log(`Sent developer report to guild ${guildId}`);
        } catch (error) {
            console.error(`Failed to send developer report to guild ${guildId}:`, error);
        }
    }
}

function scheduleDevTracker(client) {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
    );
    
    const msUntilMidnight = night.getTime() - now.getTime();
    
    setTimeout(() => {
        setInterval(() => sendReminders(client), 60 * 60 * 1000);
        setInterval(() => checkMissedCommits(client), 24 * 60 * 60 * 1000);
        setInterval(() => sendDailyReports(client), 24 * 60 * 60 * 1000);
        
        sendReminders(client);
        checkMissedCommits(client);
        sendDailyReports(client);
    }, msUntilMidnight);
    
    console.log(`Dev tracker scheduled for ${night.toString()}`);
}

module.exports = { scheduleDevTracker };