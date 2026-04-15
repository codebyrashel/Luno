const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../data/goals.json");
const REMINDER_SLOTS = [9, 12, 15, 18, 21]; // UTC hours

function loadData() {
  try {
    if (!fs.existsSync(FILE)) return ensureData({});
    const data = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return ensureData(data);
  } catch (err) {
    console.error("Failed to load goals.json:", err);
    return ensureData({});
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save goals.json:", err);
  }
}

function ensureData(data) {
  if (!data.goals) data.goals = [];
  if (!data.streaks) data.streaks = {};
  return data;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getUtcDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getSlotTime(dateKey, slotIndex) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, REMINDER_SLOTS[slotIndex], 0, 0));
  return date.getTime();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getActiveGoal(userId) {
  const data = loadData();
  return data.goals.find(goal => goal.userId === userId && goal.status === "active") || null;
}

function getStreak(userId) {
  const data = loadData();
  const streak = data.streaks[userId] || { current: 0, best: 0 };
  return { ...streak };
}

function createGoal(userId, guildId, channelId, description, days) {
  const data = loadData();
  if (getActiveGoal(userId)) {
    return { error: "You already have an active goal. Complete or cancel it before creating a new one." };
  }

  const goal = {
    id: makeId(),
    userId,
    guildId,
    channelId,
    description,
    status: "active",
    createdAt: Date.now(),
    dueAt: Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000,
    updates: [],
    reminderLog: [],
    completedAt: null,
    failedAt: null,
  };

  data.goals.push(goal);
  saveData(data);
  return { goal };
}

function logUpdate(goal, text) {
  goal.updates.push({
    timestamp: Date.now(),
    text,
  });
}

function completeGoal(userId) {
  const data = loadData();
  const goal = data.goals.find(item => item.userId === userId && item.status === "active");
  if (!goal) return { error: "No active goal found." };

  goal.status = "completed";
  goal.completedAt = Date.now();
  goal.updates.push({
    timestamp: goal.completedAt,
    text: "Completed goal",
    type: "complete",
  });

  if (!data.streaks[userId]) {
    data.streaks[userId] = { current: 0, best: 0 };
  }
  data.streaks[userId].current += 1;
  data.streaks[userId].best = Math.max(data.streaks[userId].best, data.streaks[userId].current);

  saveData(data);
  return { goal };
}

function cancelGoal(userId) {
  const data = loadData();
  const goal = data.goals.find(item => item.userId === userId && item.status === "active");
  if (!goal) return { error: "No active goal found." };

  goal.status = "cancelled";
  goal.failedAt = Date.now();
  saveData(data);
  return { goal };
}

function failGoal(goal) {
  const data = loadData();
  const stored = data.goals.find(item => item.id === goal.id);
  if (!stored || stored.status !== "active") return null;

  stored.status = "failed";
  stored.failedAt = Date.now();

  if (!data.streaks[goal.userId]) {
    data.streaks[goal.userId] = { current: 0, best: 0 };
  }
  data.streaks[goal.userId].current = 0;

  saveData(data);
  return stored;
}

function hasSentReminder(goal, dateKey, slotIndex) {
  return goal.reminderLog.some(entry => entry.date === dateKey && entry.slot === slotIndex);
}

function logReminder(goal, dateKey, slotIndex, type) {
  goal.reminderLog.push({
    date: dateKey,
    slot: slotIndex,
    type,
    sentAt: Date.now(),
  });
}

function getPendingReminders(goal, now) {
  const reminders = [];
  const todayKey = getUtcDateKey(now);
  const createdKey = getUtcDateKey(goal.createdAt);
  let progressCount = goal.reminderLog.filter(entry => entry.date === todayKey && entry.type === "progress").length;

  for (let slotIndex = 0; slotIndex < REMINDER_SLOTS.length; slotIndex += 1) {
    const slotTime = getSlotTime(todayKey, slotIndex);
    if (slotTime < goal.createdAt) continue;
    if (slotTime > now) continue;
    if (hasSentReminder(goal, todayKey, slotIndex)) continue;

    const type = progressCount < 3 ? "progress" : "encourage";
    progressCount += type === "progress" ? 1 : 0;
    reminders.push({ dateKey: todayKey, slotIndex, type, slotTime });
  }

  return reminders;
}

function formatDueText(dueAt) {
  const due = new Date(dueAt);
  return `${due.toUTCString()} UTC`;
}

async function processReminders(client) {
  const data = loadData();
  const now = Date.now();

  for (const goal of data.goals) {
    if (goal.status !== "active") continue;

    if (now >= goal.dueAt) {
      const failed = failGoal(goal);
      if (!failed) continue;
      const shameMessages = [
        "Oops! The goal got away. Time to chase it again like a legend.",
        "Goal missed! Even heroes get roasted — this one was yours.",
        "Your goal hit snooze and never woke up. Let’s do better next time.",
      ];
      const shame = shameMessages[Math.floor(Math.random() * shameMessages.length)];
      const channel = await client.channels.fetch(goal.channelId).catch(() => null);
      const message = `<@${goal.userId}> missed their goal: **${goal.description}**\n${shame}\nStreak reset to 0.`;
      if (channel && channel.send) {
        await channel.send(message).catch(() => null);
      }
      continue;
    }

    const pending = getPendingReminders(goal, now);
    if (pending.length === 0) continue;

    const channel = await client.channels.fetch(goal.channelId).catch(() => null);
    if (!channel || !channel.send) continue;

    for (const reminder of pending) {
      if (reminder.type === "progress") {
        const progressMessage = `📌 **Goal check-in** for <@${goal.userId}>:\n` +
          `Goal: **${goal.description}**\n` +
          `Due: ${formatDueText(goal.dueAt)}\n` +
          `Please post a quick update with /goal update [your progress]. Keep the momentum going!`;
        await channel.send(progressMessage).catch(() => null);
      } else {
        const boostMessage = `💥 **Goal reminder** for <@${goal.userId}>:\n` +
          `Goal: **${goal.description}**\n` +
          `You've got this — keep the pressure on and make today count.`;
        await channel.send(boostMessage).catch(() => null);
      }

      logReminder(goal, reminder.dateKey, reminder.slotIndex, reminder.type);
    }

    saveData(data);
  }
}

function getGoalStatus(userId) {
  const data = loadData();
  const goal = data.goals.find(item => item.userId === userId && item.status === "active");
  const streak = getStreak(userId);
  return { goal, streak };
}

module.exports = {
  getActiveGoal,
  createGoal,
  completeGoal,
  cancelGoal,
  updateGoal(userId, text) {
    const data = loadData();
    const goal = data.goals.find(item => item.userId === userId && item.status === "active");
    if (!goal) return { error: "No active goal found." };

    goal.updates.push({
      timestamp: Date.now(),
      text,
      type: "progress",
    });

    saveData(data);
    return { goal };
  },
  getGoalStatus,
  getStreak,
  processReminders,
};