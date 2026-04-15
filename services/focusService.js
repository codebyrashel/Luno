const sessions = new Map(); // active sessions
const history = new Map(); // userId -> [{ start, end }]

function startSession(userId, duration, channelId) {
  const now = Date.now();
  const endTime = now + duration * 60000;

  sessions.set(userId, {
    userId,
    channelId,
    startedAt: now,
    endTime
  });

  return endTime;
}

function getSession(userId) {
  return sessions.get(userId);
}

function endSession(userId) {
  const session = sessions.get(userId);
  if (!session) return null;

  const end = Date.now();

  if (!history.has(userId)) {
    history.set(userId, []);
  }

  history.get(userId).push({
    start: session.startedAt,
    end: end
  });

  sessions.delete(userId);

  return session;
}


function getUserStats(userId) {
  const userHistory = history.get(userId) || [];

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let last24 = 0;
  let last7 = 0;
  let total = 0;

  for (const session of userHistory) {
    const duration = session.end - session.start;

    total += duration;

    if (session.end >= dayAgo) {
      last24 += duration;
    }

    if (session.end >= weekAgo) {
      last7 += duration;
    }
  }

  return {
    last24,
    last7,
    total
  };
}

function formatTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}


function getAllSessions() {
  return sessions;
}

function isInSession(userId) {
  return sessions.has(userId);
}

function _getAllHistory() {
  return history;
}

module.exports = {
  startSession,
  getSession,
  endSession,
  getAllSessions,
  isInSession,
  getUserStats,
  formatTime,
  _getAllHistory,
};