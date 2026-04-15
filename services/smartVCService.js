const fs = require("fs");
const path = require("path");
const vcTracker = require("./vcTrackerService");

const FILE = path.join(__dirname, "../data/smartvc.json");
const PENDING_TIMEOUT_MS = 30 * 1000;
const pendingChecks = new Map();

function loadData() {
  try {
    if (!fs.existsSync(FILE)) return ensureData({});
    return ensureData(JSON.parse(fs.readFileSync(FILE, "utf-8")));
  } catch (err) {
    console.error("Failed to load smartvc.json:", err);
    return ensureData({});
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save smartvc.json:", err);
  }
}

function ensureData(data) {
  if (!data.configs) data.configs = {};
  return data;
}

function ensureConfig(config) {
  if (!config) config = {};
  if (config.enabled == null) config.enabled = true;
  if (config.requireMic == null) config.requireMic = false;
  return config;
}

function getConfig(guildId) {
  const data = loadData();
  return data.configs[guildId] ? ensureConfig(data.configs[guildId]) : null;
}

function setChannel(guildId, channelId, requireMic) {
  const data = loadData();
  data.configs[guildId] = ensureConfig({
    channelId,
    requireMic: !!requireMic,
    enabled: true,
  });
  saveData(data);
  return data.configs[guildId];
}

function disable(guildId) {
  const data = loadData();
  if (!data.configs[guildId]) return null;
  data.configs[guildId].enabled = false;
  saveData(data);
  return data.configs[guildId];
}

function clearPending(userId) {
  const pending = pendingChecks.get(userId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingChecks.delete(userId);
}

function hasCamera(state) {
  return !!state.selfVideo;
}

function hasMic(state) {
  return !(state.selfMute || state.serverMute);
}

function isInSmartChannel(state, config) {
  return state.channelId === config.channelId;
}

/**
 * Send DM before disconnect (best effort, Discord users love blocking bots)
 */
async function sendDisconnectDM(member, reason) {
  try {
    await member.send({
      content:
        `You were disconnected from **${member.guild.name}** voice channel.\n\n` +
        `Reason: ${reason}`,
    });
  } catch (err) {
    console.error(`Failed to DM user ${member.id}:`, err.message);
  }
}

async function disconnectMember(member, reason = "Failed smart VC requirements") {
  try {
    await sendDisconnectDM(member, reason);

    if (member.voice?.disconnect) {
      await member.voice.disconnect();
    }
  } catch (err) {
    console.error("Failed to disconnect smart VC user:", err.message);
  }
}

function startPendingCheck(member, config) {
  clearPending(member.id);

  const timeout = setTimeout(async () => {
    const guild = member.guild;
    if (!guild) return clearPending(member.id);

    const freshMember = await guild.members.fetch(member.id).catch(() => null);
    if (!freshMember || freshMember.voice.channelId !== config.channelId) {
      return clearPending(member.id);
    }

    const camera = hasCamera(freshMember.voice);
    const mic = hasMic(freshMember.voice);

    if (camera && (!config.requireMic || mic)) {
      clearPending(member.id);
      vcTracker.joinVC(member.id, true, 2);
      return;
    }

    await disconnectMember(
      freshMember,
      "You did not turn on your camera in cam-only-study room."
    );

    clearPending(member.id);
  }, PENDING_TIMEOUT_MS);

  pendingChecks.set(member.id, { timeout, config });
}

function handleSmartJoin(newState) {
  const config = getConfig(newState.guild.id);
  if (!config || !config.enabled) return;
  if (!isInSmartChannel(newState, config)) return;

  const member = newState.member;
  if (!member) return;

  const camera = hasCamera(newState);
  const mic = hasMic(newState);

  if (camera && (!config.requireMic || mic)) {
    vcTracker.joinVC(member.id, true, 2);
    clearPending(member.id);
    return;
  }

  startPendingCheck(member, config);
}

function handleSmartLeave(oldState, newState) {
  const config = getConfig(oldState.guild.id);
  if (!config || !config.enabled) return;
  if (!isInSmartChannel(oldState, config)) return;

  clearPending(oldState.member.id);
  vcTracker.leaveVC(oldState.member.id);
}

function handleSmartUpdate(oldState, newState) {
  const config = getConfig(newState.guild.id);
  if (!config || !config.enabled) return;

  if (!isInSmartChannel(newState, config)) {
    if (isInSmartChannel(oldState, config)) {
      handleSmartLeave(oldState, newState);
    }
    return;
  }

  const userId = newState.member.id;

  const wasCamera = hasCamera(oldState);
  const hasCameraNow = hasCamera(newState);

  const wasMic = hasMic(oldState);
  const hasMicNow = hasMic(newState);

  if (!wasCamera && hasCameraNow && (!config.requireMic || hasMicNow)) {
    clearPending(userId);
    vcTracker.joinVC(userId, true, 2);
    return;
  }

  if (wasCamera && !hasCameraNow) {
    vcTracker.leaveVC(userId);
    startPendingCheck(newState.member, config);
    return;
  }

  if (config.requireMic && !wasMic && hasMicNow && hasCameraNow) {
    clearPending(userId);
    vcTracker.joinVC(userId, true, 2);
    return;
  }

  if (config.requireMic && wasMic && !hasMicNow && hasCameraNow) {
    vcTracker.leaveVC(userId);
    startPendingCheck(newState.member, config);
  }
}

function voiceStateUpdate(oldState, newState) {
  const oldChannel = oldState.channelId;
  const newChannel = newState.channelId;

  const config = getConfig(newState.guild.id);
  if (!config || !config.enabled) return;

  if (oldChannel !== config.channelId && newChannel === config.channelId) {
    handleSmartJoin(newState);
    return;
  }

  if (oldChannel === config.channelId && newChannel !== config.channelId) {
    handleSmartLeave(oldState, newState);
    return;
  }

  if (oldChannel === config.channelId && newChannel === config.channelId) {
    handleSmartUpdate(oldState, newState);
  }
}

module.exports = {
  setChannel,
  disable,
  getStatus: getConfig,
  voiceStateUpdate,
};