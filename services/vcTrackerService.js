const fs = require("fs");
const path = require("path");

// File path for storing voice channel tracking data
const FILE = path.join(__dirname, "../data/vc.json");

/**
 * Loads voice channel tracking data from the JSON file.
 * @returns {Object} The data object containing user VC sessions
 */
function loadData() {
  try {
    if (!fs.existsSync(FILE)) return { _meta: { weeklyReset: getWeekStart() } };
    const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return ensureMeta(data);
  } catch (err) {
    console.error("Failed to load vc.json:", err);
    return { _meta: { weeklyReset: getWeekStart() } };
  }
}

/**
 * Saves voice channel tracking data to the JSON file.
 * @param {Object} data - The data object to save
 */
function saveData(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save vc.json:", err);
  }
}

/**
 * Normalizes stored data with default meta and user fields.
 * @param {Object} data
 * @returns {Object}
 */
function ensureMeta(data) {
  if (!data._meta) {
    data._meta = { weeklyReset: getWeekStart() };
  }

  if (data._meta.weeklyReset == null) {
    data._meta.weeklyReset = getWeekStart();
  }

  for (const key of Object.keys(data)) {
    if (key === "_meta") continue;
    data[key] = ensureUser(data[key]);
  }

  return data;
}

function ensureUser(user) {
  if (!user) user = {};
  if (!Array.isArray(user.sessions)) user.sessions = [];
  if (user.totalXp == null) user.totalXp = 0;
  if (user.weeklyXp == null) user.weeklyXp = 0;
  if (user.active == null) user.active = null;
  if (user.activeBonus == null) user.activeBonus = 1;
  return user;
}

function getWeekStart(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function countXp(milliseconds) {
  return Math.max(0, Math.floor(milliseconds / 60000));
}

function stopActiveSession(user, now) {
  if (!user || !user.active) return 0;

  const duration = now - user.active;
  const xp = countXp(duration) * (user.activeBonus || 1);

  user.sessions.push({
    start: user.active,
    end: now,
    xp,
    bonusMultiplier: user.activeBonus || 1,
  });

  user.active = null;
  user.activeBonus = 1;
  user.totalXp += xp;
  user.weeklyXp += xp;

  return xp;
}

function ensureWeeklyReset() {
  const data = loadData();
  const weekStart = getWeekStart();

  if (data._meta.weeklyReset < weekStart) {
    for (const key of Object.keys(data)) {
      if (key === "_meta") continue;
      data[key] = ensureUser(data[key]);
      data[key].weeklyXp = 0;

      if (data[key].active && data[key].active < weekStart) {
        data[key].active = weekStart;
      }
    }

    data._meta.weeklyReset = weekStart;
    saveData(data);
  }
}

/**
 * Tracks when a user joins a voice channel and starts counting XP if eligible.
 * @param {string} userId
 * @param {boolean} canCount - Whether the session should be counted (not AFK)
 */
function joinVC(userId, canCount = true, bonusMultiplier = 1) {
  const data = loadData();
  const now = Date.now();

  if (!data[userId]) {
    data[userId] = ensureUser({});
  }

  if (!data[userId].active && canCount) {
    data[userId].active = now;
    data[userId].activeBonus = bonusMultiplier;
    console.log(`User ${userId} started counting VC at ${new Date(now).toISOString()} with bonus x${bonusMultiplier}`);
  }

  saveData(data);
}

/**
 * Tracks when a user leaves a voice channel or becomes AFK.
 * @param {string} userId
 */
function leaveVC(userId) {
  const data = loadData();
  const now = Date.now();
  const user = data[userId];
  if (!user) return;

  const xp = stopActiveSession(user, now);
  if (xp > 0) {
    console.log(`User ${userId} stopped counting VC at ${new Date(now).toISOString()}, earned ${xp} XP`);
  }

  saveData(data);
}

/**
 * Calculates the total time a user has spent in voice channels within a given range.
 * Includes both completed sessions and the current counted session if applicable.
 * @param {string} userId
 * @param {string} range - Time range: "24h" or "7d"
 * @returns {number} Total time in milliseconds
 */
function getTime(userId, range) {
  const data = loadData();
  const user = data[userId];
  if (!user) return 0;

  const now = Date.now();
  const cutoff =
    range === "24h"
      ? now - 24 * 60 * 60 * 1000
      : now - 7 * 24 * 60 * 60 * 1000;

  let total = 0;

  for (const s of user.sessions) {
    if (s.end >= cutoff) {
      const start = Math.max(s.start, cutoff);
      total += s.end - start;
    }
  }

  if (user.active && user.active >= cutoff) {
    total += now - user.active;
  }

  return total;
}

/**
 * Calculates XP earned in a given range.
 * @param {string} userId
 * @param {string} range - Time range: "24h" or "7d"
 * @returns {number} XP earned in the range
 */
function getXp(userId, range) {
  const data = loadData();
  const user = data[userId];
  if (!user) return 0;

  const now = Date.now();
  const cutoff =
    range === "24h"
      ? now - 24 * 60 * 60 * 1000
      : now - 7 * 24 * 60 * 60 * 1000;

  let totalXp = 0;

  for (const s of user.sessions) {
    if (s.end >= cutoff) {
      totalXp += s.xp || Math.max(0, Math.floor((s.end - s.start) / 60000));
    }
  }

  if (user.active && user.active >= cutoff) {
    totalXp += countXp(now - user.active) * (user.activeBonus || 1);
  }

  return totalXp;
}

function getTotalXp(userId) {
  const data = loadData();
  const user = data[userId];
  return user ? user.totalXp || 0 : 0;
}

function getWeeklyLeaderboard() {
  const data = loadData();
  const result = [];

  for (const userId in data) {
    if (userId === "_meta") continue;
    const user = ensureUser(data[userId]);
    if (user.weeklyXp > 0) result.push([userId, user.weeklyXp]);
  }

  return result.sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function getWeeklyXp(userId) {
  const data = loadData();
  const user = data[userId];
  return user ? user.weeklyXp || 0 : 0;
}

function getLevel(xp) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

function xpForLevel(level) {
  return 100 * (level - 1) * (level - 1);
}

function xpToNextLevel(xp) {
  const nextLevel = getLevel(xp) + 1;
  return xpForLevel(nextLevel) - xp;
}

function getWeeklyRank(userId) {
  const data = loadData();
  const result = [];

  for (const id in data) {
    if (id === "_meta") continue;
    const user = ensureUser(data[id]);
    result.push([id, user.weeklyXp]);
  }

  result.sort((a, b) => b[1] - a[1]);

  const rank = result.findIndex(([id]) => id === userId);
  return rank === -1 ? null : rank + 1;
}

/**
 * Generates a leaderboard of users by their voice channel time for a given range.
 * Returns top 10 users sorted by total time descending.
 * @param {string} range - Time range: "24h" or "7d"
 * @returns {Array} Array of [userId, timeMs] pairs, sorted by time descending
 */
function getLeaderboard(range) {
  const data = loadData();
  const result = [];

  for (const userId in data) {
    if (userId === "_meta") continue;
    const time = getTime(userId, range);
    if (time > 0) result.push([userId, time]);
  }

  return result.sort((a, b) => b[1] - a[1]).slice(0, 10);
}

/**
 * Formats milliseconds into a human-readable hours and minutes string.
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string like "2h 30m"
 */
function formatTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

module.exports = {
  joinVC,      // Records user joining voice channel and starts XP counting when eligible
  leaveVC,     // Records user leaving voice channel or going AFK
  getTime,     // Gets total VC time for a user in a time range
  getXp,       // Gets XP earned in a time range
  getTotalXp,  // Gets total lifetime XP for a user
  getWeeklyXp, // Gets current weekly XP for a user
  getLevel,    // Converts XP into a simple level value
  xpToNextLevel, // XP required to reach next level
  getWeeklyRank, // Gets a user's current weekly rank
  getLeaderboard, // Gets top users by VC time
  getWeeklyLeaderboard, // Gets top weekly grinders by XP
  ensureWeeklyReset, // Resets weekly XP on schedule
  formatTime,  // Formats milliseconds to "Xh Ym" string
};