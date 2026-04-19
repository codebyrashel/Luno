const fs = require("fs");
const path = require("path");
const githubService = require("./githubService");
const codeforcesService = require("./codeforcesService");

const FILE = path.join(__dirname, "../data/devtracker.json");

function loadData() {
    try {
        if (!fs.existsSync(FILE)) {
            return { users: {}, settings: {}, reminders: {} };
        }
        return JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch (err) {
        console.error("Failed to load devtracker.json:", err);
        return { users: {}, settings: {}, reminders: {} };
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to save devtracker.json:", err);
    }
}

function registerUser(userId, platform, username) {
    const data = loadData();
    
    if (!data.users[userId]) {
        data.users[userId] = {
            github: null,
            leetcode: null,
            codeforces: null,
            registeredAt: Date.now(),
            lastCheck: null,
            lastCommitDate: null,
            missedDays: 0,
            history: []
        };
    }
    
    data.users[userId][platform] = username;
    saveData(data);
    return true;
}

function getUserProfile(userId) {
    const data = loadData();
    return data.users[userId] || null;
}

function updateLastCommit(userId, date) {
    const data = loadData();
    if (data.users[userId]) {
        data.users[userId].lastCommitDate = date;
        saveData(data);
    }
}

function incrementMissedDays(userId) {
    const data = loadData();
    if (data.users[userId]) {
        data.users[userId].missedDays = (data.users[userId].missedDays || 0) + 1;
        saveData(data);
        return data.users[userId].missedDays;
    }
    return 0;
}

function resetMissedDays(userId) {
    const data = loadData();
    if (data.users[userId]) {
        data.users[userId].missedDays = 0;
        saveData(data);
    }
}

function setReportChannel(guildId, channelId, type) {
    const data = loadData();
    if (!data.settings[guildId]) {
        data.settings[guildId] = {};
    }
    data.settings[guildId][type] = channelId;
    saveData(data);
    return true;
}

function getReportChannel(guildId, type) {
    const data = loadData();
    return data.settings[guildId] ? data.settings[guildId][type] : null;
}

function setReminderTime(guildId, hour) {
    const data = loadData();
    if (!data.settings[guildId]) {
        data.settings[guildId] = {};
    }
    data.settings[guildId].reminderHour = hour;
    saveData(data);
    return true;
}

function getReminderTime(guildId) {
    const data = loadData();
    return data.settings[guildId] ? data.settings[guildId].reminderHour : 20;
}

function recordReminderSent(guildId, date, hour) {
    const data = loadData();
    if (!data.reminders[guildId]) {
        data.reminders[guildId] = {};
    }
    const dateKey = `${date}_${hour}`;
    data.reminders[guildId][dateKey] = true;
    saveData(data);
}

function wasReminderSent(guildId, date, hour) {
    const data = loadData();
    const dateKey = `${date}_${hour}`;
    return data.reminders[guildId] && data.reminders[guildId][dateKey];
}

function clearReminders(guildId, date) {
    const data = loadData();
    if (data.reminders[guildId]) {
        for (const key of Object.keys(data.reminders[guildId])) {
            if (key.startsWith(date)) {
                delete data.reminders[guildId][key];
            }
        }
        saveData(data);
    }
}

async function fetchUserStats(userId, userData) {
    const stats = {
        userId: userId,
        timestamp: Date.now(),
        github: { commitsToday: 0, commitsWeek: 0, streak: 0, username: null, hasCommittedToday: false },
        leetcode: { solvedToday: 0, solvedWeek: 0, totalSolved: 0, username: null },
        codeforces: { solvedToday: 0, solvedWeek: 0, rating: 0, username: null }
    };
    
    if (userData.github) {
        stats.github.username = userData.github;
        stats.github.commitsToday = await githubService.getTodayCommits(userData.github);
        stats.github.commitsWeek = await githubService.getWeeklyCommits(userData.github);
        stats.github.streak = await githubService.getContributionStreak(userData.github);
        stats.github.hasCommittedToday = stats.github.commitsToday > 0;
        
        if (stats.github.hasCommittedToday) {
            updateLastCommit(userId, new Date().toISOString().split('T')[0]);
            resetMissedDays(userId);
        }
    }
    
    if (userData.codeforces) {
        stats.codeforces.username = userData.codeforces;
        stats.codeforces.solvedToday = await codeforcesService.getTodaySolved(userData.codeforces);
        stats.codeforces.solvedWeek = await codeforcesService.getWeeklySolved(userData.codeforces);
        stats.codeforces.rating = await codeforcesService.getUserRating(userData.codeforces);
    }
    
    return stats;
}

function formatUserStats(stats) {
    let output = `[ Developer Stats ]\n\n`;
    
    if (stats.github.username) {
        output += `GitHub: ${stats.github.username}\n`;
        output += `- Commits today: ${stats.github.commitsToday}\n`;
        output += `- Commits this week: ${stats.github.commitsWeek}\n`;
        output += `- Contribution streak: ${stats.github.streak} days\n\n`;
    }
    
    if (stats.codeforces.username) {
        output += `Codeforces: ${stats.codeforces.username}\n`;
        output += `- Problems solved today: ${stats.codeforces.solvedToday}\n`;
        output += `- Problems solved this week: ${stats.codeforces.solvedWeek}\n`;
        output += `- Current rating: ${stats.codeforces.rating}\n\n`;
    }
    
    const hasActivityToday = stats.github.commitsToday > 0 || stats.codeforces.solvedToday > 0;
    output += `Activity today: ${hasActivityToday ? "Yes" : "No"}\n`;
    output += `Last updated: ${new Date(stats.timestamp).toLocaleString()}`;
    
    return output;
}

function getShameMessage(missedDays) {
    const messages = [
        "Your code is gathering dust. Even your keyboard is getting lonely.",
        "GitHub is feeling neglected. Your repos are crying.",
        "Did your fingers take a vacation? Time to get back to work!",
        "Your contribution graph is looking pale. Feed it some commits!",
        "The commit fairy is disappointed. Don't make her cry.",
        "Your streak is broken. The developer gods are not pleased.",
        "Even VS Code misses you. Open it and write some code!",
        "Your repo is like a ghost town. Time to become the sheriff.",
        "The only thing not committing today is your code.",
        "Your productivity is lower than your room temperature."
    ];
    
    const index = Math.min(missedDays - 1, messages.length - 1);
    return messages[index];
}

function getReminderMessage(hour) {
    if (hour < 12) {
        return "Good morning! Don't forget to make your GitHub commits today. Your contribution streak is waiting!";
    } else if (hour < 17) {
        return "Afternoon check-in! Have you made your commits today? Your streak depends on it!";
    } else if (hour < 21) {
        return "Evening reminder! Still time to get those commits in before the day ends. Don't break your streak!";
    } else {
        return "Final reminder! The day is almost over. Make your commits now or your streak will reset!";
    }
}

module.exports = {
    loadData,
    saveData,
    registerUser,
    getUserProfile,
    updateLastCommit,
    incrementMissedDays,
    resetMissedDays,
    setReportChannel,
    getReportChannel,
    setReminderTime,
    getReminderTime,
    recordReminderSent,
    wasReminderSent,
    clearReminders,
    fetchUserStats,
    formatUserStats,
    getShameMessage,
    getReminderMessage
};