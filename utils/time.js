const focusService = require("../services/focusService");
const vcTracker = require("../services/vcTrackerService");
const goalService = require("../services/goalService");

function startFocusWatcher(client) {
  setInterval(async () => {
    vcTracker.ensureWeeklyReset();

    const sessions = focusService.getAllSessions();
    const now = Date.now();

    for (const [userId, session] of sessions.entries()) {
      if (now >= session.endTime) {
        focusService.endSession(userId);

        try {
          for (const guild of client.guilds.cache.values()) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) continue;

            // UNMUTE USER
            try {
              await member.voice.setMute(false);
            } catch {}

            try {
              await member.send("Your focus session has ended.");
            } catch {}
          }
        } catch (err) {
          console.log("Watcher error:", err.message);
        }
      }
    }
  }, 5000);
}

function startGoalWatcher(client) {
  setInterval(async () => {
    try {
      await goalService.processReminders(client);
    } catch (err) {
      console.log("Goal watcher error:", err.message);
    }
  }, 300000);
}

module.exports = { startFocusWatcher, startGoalWatcher };