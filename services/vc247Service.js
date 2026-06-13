const fs = require("fs");
const path = require("path");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const FILE = path.join(__dirname, "../data/voice247.json");

function loadData() {
  try {
    if (!fs.existsSync(FILE)) return ensureData({});
    return ensureData(JSON.parse(fs.readFileSync(FILE, "utf-8")));
  } catch (err) {
    console.error("Failed to load voice247.json:", err);
    return ensureData({});
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save voice247.json:", err);
  }
}

function ensureData(data) {
  if (!data.configs) data.configs = {};
  return data;
}

function ensureConfig(config) {
  if (!config) config = {};
  if (config.enabled == null) config.enabled = false;
  return config;
}

function getStatus(guildId) {
  const data = loadData();
  return data.configs[guildId] ? ensureConfig(data.configs[guildId]) : null;
}

function setChannel(guildId, channelId) {
  const data = loadData();
  data.configs[guildId] = ensureConfig({
    channelId,
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

function connect(guild, channel) {
  let connection = getVoiceConnection(guild.id);

  if (connection && connection.joinConfig.channelId !== channel.id) {
    connection.destroy();
    connection = null;
  }

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
  }

  return connection;
}

module.exports = {
  getStatus,
  setChannel,
  disable,
  connect,
};
