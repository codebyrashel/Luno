const fs = require("fs");
const path = require("path");
const githubService = require("./githubService");

const FILE = path.join(__dirname, "../data/devtracker.json");

// Bangladesh timezone offset (UTC+6)
const TIMEZONE_OFFSET = 6 * 60 * 60 * 1000;

function getBangladeshDateTime(timestamp = Date.now()) {
    const bangladeshTime = new Date(timestamp + TIMEZONE_OFFSET);
    const year = bangladeshTime.getUTCFullYear();
    const month = String(bangladeshTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(bangladeshTime.getUTCDate()).padStart(2, '0');
    let hours = bangladeshTime.getUTCHours();
    const minutes = String(bangladeshTime.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

function loadData() {
    try {
        if (!fs.existsSync(FILE)) {
            return { users: {}, settings: {} };
        }
        return JSON.parse(fs.readFileSync(FILE, "utf-8"));
    } catch (err) {
        console.error("Failed to load devtracker.json:", err);
        return { users: {}, settings: {} };
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Failed to save devtracker.json:", err);
    }
}

function registerUser(userId, github) {
    const data = loadData();

    if (!data.users[userId]) {
        data.users[userId] = {
            github: null,
            registeredAt: Date.now(),
            lastCommitDate: null,
            missedDays: 0
        };
    }

    data.users[userId].github = github;
    saveData(data);
    return true;
}

function getUserProfile(userId) {
    const data = loadData();
    return data.users[userId] || null;
}

function getAllUsers() {
    const data = loadData();
    return data.users;
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

async function fetchUserStats(userId, userData) {
    const stats = {
        userId: userId,
        timestamp: Date.now(),
        github: { commitsToday: 0, commitsWeek: 0, streak: 0, username: null, hasCommittedToday: false }
    };

    if (userData.github) {
        stats.github.username = userData.github;
        stats.github.commitsToday = await githubService.getTodayCommits(userData.github);
        stats.github.commitsWeek = await githubService.getWeeklyCommits(userData.github);
        stats.github.streak = await githubService.getContributionStreak(userData.github);
        stats.github.hasCommittedToday = stats.github.commitsToday > 0;

        if (stats.github.hasCommittedToday) {
            const bangladeshDate = githubService.getBangladeshDate();
            updateLastCommit(userId, bangladeshDate);
            resetMissedDays(userId);
        }
    }

    return stats;
}

function formatUserStats(stats) {
    let output = `** Developer Stats **\n\n`;

    if (stats.github.username) {
        output += `GitHub: ${stats.github.username}\n`;
        output += `- Commits today: ${stats.github.commitsToday}\n`;
        output += `- Commits this week: ${stats.github.commitsWeek}\n`;
        output += `- Contribution streak: ${stats.github.streak} days\n\n`;
    } else {
        output += "No GitHub profile registered.\n";
    }

    const bangladeshTime = getBangladeshDateTime(stats.timestamp);
    output += `Last updated: ${bangladeshTime} (Bangladesh Time)`;

    return output;
}

function getLeaderboard() {
    return new Promise(async (resolve) => {
        const data = loadData();
        const results = [];

        for (const [userId, userData] of Object.entries(data.users)) {
            if (userData.github) {
                const commitsWeek = await githubService.getWeeklyCommits(userData.github);
                results.push({ userId, username: userData.github, commitsWeek });
            }
        }

        results.sort((a, b) => b.commitsWeek - a.commitsWeek);
        resolve(results.slice(0, 10));
    });
}

const shameMessages = [
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

function getShameMessage(missedDays) {
    const index = Math.min(missedDays - 1, shameMessages.length - 1);
    return shameMessages[index];
}

const reminderMessages = {
    morning: "Good morning developers! Don't forget to make your GitHub commits today. Your contribution streak is waiting!",
    afternoon: "Afternoon check-in! Have you made your commits today? Your streak depends on it!",
    evening: "Evening reminder! Still time to get those commits in before the day ends. Don't break your streak!",
    night: "Final reminder! The day is almost over. Make your commits now or your streak will reset at midnight!"
};

function getReminderMessage(hour) {
    if (hour < 12) {
        return reminderMessages.morning;
    } else if (hour < 17) {
        return reminderMessages.afternoon;
    } else if (hour < 21) {
        return reminderMessages.evening;
    } else {
        return reminderMessages.night;
    }
}

module.exports = {
    loadData,
    registerUser,
    getUserProfile,
    getAllUsers,
    setReportChannel,
    getReportChannel,
    updateLastCommit,
    incrementMissedDays,
    resetMissedDays,
    fetchUserStats,
    formatUserStats,
    getLeaderboard,
    getShameMessage,
    getReminderMessage
};