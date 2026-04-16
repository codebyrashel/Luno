// =======================
// IMPORTS
// =======================
require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const {
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  joinVoiceChannel,
  getVoiceConnection,
} = require("@discordjs/voice");
const { spawn } = require("child_process");
const fs = require("fs");

const interactionHandler = require("./events/interactionHandler");
const { startFocusWatcher, startGoalWatcher } = require("./utils/time");
const vcTracker = require("./services/vcTrackerService");
const smartVCService = require("./services/smartVCService");
const musicService = require("./services/musicService");
const leetcodeService = require("./services/leetcodeService");

// =======================
// CONFIG
// =======================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// =======================
// DISCORD CLIENT
// =======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =======================
// COMMANDS
// =======================
const commands = [
  // MUSIC
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play YouTube audio")
    .addStringOption(opt =>
      opt.setName("url")
        .setDescription("YouTube URL or Playlist")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop and disconnect bot"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show current music queue"),

  // FOCUS
  new SlashCommandBuilder()
    .setName("focus")
    .setDescription("Focus system")
    .addSubcommand(cmd =>
      cmd.setName("start")
        .setDescription("Start focus session")
        .addIntegerOption(opt =>
          opt.setName("minutes")
            .setDescription("Duration")
            .setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("stop")
        .setDescription("Stop session")
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Check session")
    ),

  // LEADERBOARD / LEVEL RANK
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("VC activity and weekly level leaderboard")
    .addSubcommand(cmd =>
      cmd.setName("stats")
        .setDescription("Show your VC stats and level progress")
        .addStringOption(opt =>
          opt.setName("range")
            .setDescription("Time range")
            .setRequired(true)
            .addChoices(
              { name: "Last 24 hours", value: "24h" },
              { name: "Last 7 days", value: "7d" }
            )
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("vc")
        .setDescription("Show VC time leaderboard")
        .addStringOption(opt =>
          opt.setName("range")
            .setDescription("Time range")
            .setRequired(true)
            .addChoices(
              { name: "Last 24 hours", value: "24h" },
              { name: "Last 7 days", value: "7d" }
            )
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("level")
        .setDescription("Show weekly level rank")
    ),

  // SMART VC SYSTEM
  new SlashCommandBuilder()
    .setName("smartvc")
    .setDescription("Configure smart VC enforcement for a meeting channel")
    .addSubcommand(cmd =>
      cmd.setName("set")
        .setDescription("Set the enforced channel and optional mic requirement")
        .addChannelOption(opt =>
          opt.setName("channel")
            .setDescription("Voice channel to enforce")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addBooleanOption(opt =>
          opt.setName("requiremic")
            .setDescription("Require microphone activity")
            .setRequired(false)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Show current smart VC configuration")
    )
    .addSubcommand(cmd =>
      cmd.setName("disable")
        .setDescription("Disable smart VC enforcement")
    ),

  // GOAL ACCOUNTABILITY
  new SlashCommandBuilder()
    .setName("goal")
    .setDescription("Set, update, and complete accountability goals")
    .addSubcommand(cmd =>
      cmd.setName("set")
        .setDescription("Set a new goal")
        .addStringOption(opt =>
          opt.setName("description")
            .setDescription("Your goal description")
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName("days")
            .setDescription("Days until due")
            .setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Show your active goal status")
    )
    .addSubcommand(cmd =>
      cmd.setName("update")
        .setDescription("Log progress on your active goal")
        .addStringOption(opt =>
          opt.setName("progress")
            .setDescription("Your progress update")
            .setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("complete")
        .setDescription("Mark your active goal as complete")
    )
    .addSubcommand(cmd =>
      cmd.setName("cancel")
        .setDescription("Cancel your active goal")
    ),

  // LEETCODE DAILY CHALLENGE
  new SlashCommandBuilder()
    .setName("leetcode")
    .setDescription("LeetCode daily challenge settings")
    .addSubcommand(cmd =>
      cmd.setName("setchannel")
        .setDescription("Set the channel for daily LeetCode problems")
        .addChannelOption(opt =>
          opt.setName("channel")
            .setDescription("Text channel to send daily problems")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("disable")
        .setDescription("Disable daily LeetCode problems")
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Check LeetCode daily challenge status")
    )
    .addSubcommand(cmd =>
      cmd.setName("now")
        .setDescription("Get today's LeetCode daily challenge immediately")
    ),

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Slash commands registered");
}

// =======================
// YT-DLP STREAM (for simple play)
// =======================
function getAudioStream(url) {
  const yt = spawn("yt-dlp", [
    "-f",
    "bestaudio",
    "-o",
    "-",
    url,
  ]);

  return yt.stdout;
}

// =======================
// LEETCODE DAILY SCHEDULER FUNCTIONS
// =======================
function ensureDataFolder() {
  const dataDir = "./data";
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    console.log("Created data folder");
  }
  return dataDir;
}

function loadLeetcodeSettings() {
  ensureDataFolder();
  try {
    const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
    const settings = JSON.parse(data);
    
    for (const [guildId, setting] of Object.entries(settings)) {
      leetcodeService.setDailyChannel(guildId, setting.channelId);
    }
    console.log("Loaded LeetCode settings from data folder");
  } catch (error) {
    console.log("No saved LeetCode settings found in data folder");
  }
}

function saveLeetcodeSettings(guildId, channelId) {
  ensureDataFolder();
  let leetcodeSettings = {};
  try {
    const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
    leetcodeSettings = JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
  }
  
  leetcodeSettings[guildId] = {
    guildId: guildId,
    channelId: channelId,
    enabled: true
  };
  fs.writeFileSync("./data/leetcodeSettings.json", JSON.stringify(leetcodeSettings, null, 2));
}

function removeLeetcodeSettings(guildId) {
  ensureDataFolder();
  let leetcodeSettings = {};
  try {
    const data = fs.readFileSync("./data/leetcodeSettings.json", "utf8");
    leetcodeSettings = JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
  }
  
  delete leetcodeSettings[guildId];
  fs.writeFileSync("./data/leetcodeSettings.json", JSON.stringify(leetcodeSettings, null, 2));
}

function scheduleDailyChallenge() {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0
  );
  
  const msUntilMidnight = night.getTime() - now.getTime();
  
  setTimeout(() => {
    sendDailyChallengesToAllGuilds();
    setInterval(sendDailyChallengesToAllGuilds, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
  
  console.log(`Daily challenge scheduled for ${night.toString()}`);
}

async function sendDailyChallengesToAllGuilds() {
  console.log("Sending daily LeetCode challenges...");
  
  for (const [guildId, setting] of leetcodeService.settings) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      
      const channel = guild.channels.cache.get(setting.channelId);
      if (!channel) continue;
      
      await leetcodeService.sendDailyChallenge(channel);
      console.log(`Sent daily challenge to guild ${guildId}`);
    } catch (error) {
      console.error(`Failed to send daily challenge to guild ${guildId}:`, error);
    }
  }
}

// =======================
// READY
// =======================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  startFocusWatcher(client);
  startGoalWatcher(client);
  loadLeetcodeSettings();
  scheduleDailyChallenge();
});

// =======================
// HELPER FUNCTIONS FOR MUSIC EMBED
// =======================
function createMusicEmbed(session, currentSong, title) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(`**${currentSong?.title || "Nothing playing"}**`)
    .addFields(
      { name: "Requested by", value: currentSong?.requester?.username || "Unknown", inline: true },
      { name: "Duration", value: musicService.formatTime(currentSong?.duration), inline: true },
      { name: "Loop Mode", value: session.loop === "off" ? "Disabled" : session.loop === "song" ? "Single Song" : "Queue", inline: true },
      { name: "Queue Length", value: `${session.queue.length} songs`, inline: true }
    )
    .setFooter({ text: "Music Player Controls" })
    .setTimestamp();

  if (currentSong?.thumbnail) {
    embed.setThumbnail(currentSong.thumbnail);
  }

  return embed;
}

function createControlButtons(session) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("music_previous")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_play_pause")
        .setLabel(session.playing ? "Pause" : "Play")
        .setStyle(session.playing ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("music_next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_loop")
        .setLabel(session.loop === "off" ? "Loop: Off" : session.loop === "song" ? "Loop: Song" : "Loop: Queue")
        .setStyle(session.loop !== "off" ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  
  return row;
}

// =======================
// VC TRACKING (FIXED LOCATION)
// =======================
client.on("voiceStateUpdate", (oldState, newState) => {
  console.log(`Voice state update: ${oldState.channelId} -> ${newState.channelId} for user ${newState.member?.id}`);
  const userId = newState.member?.id;
  if (!userId || newState.member.user.bot) return;

  const oldVC = oldState.channelId;
  const newVC = newState.channelId;
  const oldMuted = oldState.selfMute || oldState.serverMute;
  const newMuted = newState.selfMute || newState.serverMute;
  const isCounting = !newMuted;

  const smartConfig = smartVCService.getStatus(newState.guild.id);
  const smartChannelId = smartConfig && smartConfig.enabled ? smartConfig.channelId : null;
  const oldInSmart = oldVC === smartChannelId;
  const newInSmart = newVC === smartChannelId;

  if (!oldInSmart && !newInSmart) {
    if (!oldVC && newVC) {
      vcTracker.joinVC(userId, isCounting);
    }

    if (oldVC && !newVC) {
      vcTracker.leaveVC(userId);
    }

    if (oldVC && newVC && oldVC !== newVC) {
      vcTracker.leaveVC(userId);
      vcTracker.joinVC(userId, isCounting);
    }

    if (oldVC && newVC && oldVC === newVC) {
      if (oldMuted && !newMuted) {
        vcTracker.joinVC(userId, true);
      }
      if (!oldMuted && newMuted) {
        vcTracker.leaveVC(userId);
      }
    }
  } else if (oldInSmart && !newInSmart) {
    vcTracker.leaveVC(userId);
    if (newVC) {
      vcTracker.joinVC(userId, isCounting);
    }
  }

  smartVCService.voiceStateUpdate(oldState, newState);

  // Auto-disconnect bot when no users in voice channel
  const botId = client.user.id;
  const botNewChannel = newState.guild.members.me?.voice.channel;
  
  if (botNewChannel) {
    const members = botNewChannel.members.filter(member => !member.user.bot);
    if (members.size === 0) {
      setTimeout(() => {
        const currentMembers = botNewChannel.members.filter(member => !member.user.bot);
        if (currentMembers.size === 0) {
          musicService.stop(newState.guild);
        }
      }, 30000);
    }
  }
});

// =======================
// INTERACTIONS
// =======================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // -------------------
  // LEETCODE COMMANDS
  // -------------------
  if (interaction.commandName === "leetcode") {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === "setchannel") {
      const channel = interaction.options.getChannel("channel");
      
      if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ 
          content: "Please select a text channel!", 
          ephemeral: true 
        });
      }
      
      leetcodeService.setDailyChannel(interaction.guild.id, channel.id);
      saveLeetcodeSettings(interaction.guild.id, channel.id);
      
      await interaction.reply({ 
        content: `Daily LeetCode problems will be sent to ${channel}!`, 
        ephemeral: true 
      });
    }
    
    else if (subcommand === "disable") {
      leetcodeService.disableDaily(interaction.guild.id);
      removeLeetcodeSettings(interaction.guild.id);
      
      await interaction.reply({ 
        content: "Daily LeetCode problems have been disabled!", 
        ephemeral: true 
      });
    }
    
    else if (subcommand === "status") {
      const isEnabled = leetcodeService.isDailyEnabled(interaction.guild.id);
      const channelId = leetcodeService.getDailyChannel(interaction.guild.id);
      const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
      
      let statusText = isEnabled 
        ? `Enabled - Sending to ${channel ? channel.name : "unknown channel"}`
        : "Disabled";
      
      await interaction.reply({ 
        content: `LeetCode Daily Challenge Status:\n${statusText}`,
        ephemeral: true 
      });
    }
    
    else if (subcommand === "now") {
      await interaction.deferReply();
      
      try {
        await leetcodeService.sendDailyChallenge(interaction.channel);
        await interaction.editReply("Today's LeetCode daily challenge has been posted above!");
      } catch (error) {
        console.error(error);
        await interaction.editReply("Failed to fetch today's daily challenge. Please try again later.");
      }
    }
    
    return;
  }

  // -------------------
  // MUSIC COMMANDS
  // -------------------
  if (interaction.commandName === "play") {
    await interaction.deferReply();

    const url = interaction.options.getString("url");
    if (!url) return interaction.editReply("No URL provided.");

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply("Join a voice channel first.");
    }

    try {
      const songInfo = await musicService.addSong(interaction.guild, voiceChannel, url, interaction.user);
      
      const session = musicService.getSession(interaction.guild.id);
      
      const embed = createMusicEmbed(session, songInfo, "Added to queue");
      const row = createControlButtons(session);
      
      if (session.lastMessage && session.lastMessage.editable) {
        await session.lastMessage.edit({ embeds: [embed], components: [row] });
        await interaction.editReply("Added to queue!");
      } else {
        const msg = await interaction.editReply({ embeds: [embed], components: [row] });
        session.lastMessage = msg;
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to play video.");
    }
    return;
  }

  if (interaction.commandName === "stop") {
    await interaction.deferReply();
    musicService.stop(interaction.guild);
    await interaction.editReply("Disconnected and cleared queue");
    return;
  }

  if (interaction.commandName === "queue") {
    const session = musicService.getSession(interaction.guild.id);
    
    if (!session || (!session.current && session.queue.length === 0)) {
      return interaction.reply("No music is playing or queued!");
    }
    
    let queueText = "";
    if (session.current) {
      queueText += `**Now Playing:** ${session.current.title}\n\n`;
    }
    
    if (session.queue.length > 0) {
      queueText += `**Queue (${session.queue.length} songs):**\n`;
      session.queue.slice(0, 10).forEach((song, index) => {
        queueText += `${index + 1}. ${song.title}\n`;
      });
      
      if (session.queue.length > 10) {
        queueText += `\nAnd ${session.queue.length - 10} more...`;
      }
    } else {
      queueText += "Queue is empty!";
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Music Queue")
      .setDescription(queueText)
      .setFooter({ text: `Loop mode: ${session.loop}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // -------------------
  // MODULAR (FOCUS, LEADERBOARD etc)
  // -------------------
  await interactionHandler(interaction);
});

// =======================
// BUTTON INTERACTIONS
// =======================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  
  const session = musicService.getSession(interaction.guild.id);
  
  if (!session || !session.playing) {
    return interaction.reply({ content: "No music is playing!", ephemeral: true });
  }
  
  switch (interaction.customId) {
    case "music_previous":
      const prevSuccess = musicService.prev(interaction.guild);
      if (!prevSuccess) {
        await interaction.reply({ content: "No previous song in history!", ephemeral: true });
      } else {
        await interaction.reply({ content: "Playing previous song!", ephemeral: true });
      }
      break;
      
    case "music_play_pause":
      const status = musicService.togglePause(interaction.guild);
      if (status === "paused") {
        await interaction.reply({ content: "Paused", ephemeral: true });
      } else if (status === "playing") {
        await interaction.reply({ content: "Resumed", ephemeral: true });
      }
      break;
      
    case "music_next":
      const skipSuccess = musicService.skip(interaction.guild);
      if (!skipSuccess) {
        await interaction.reply({ content: "No next song in queue!", ephemeral: true });
      } else {
        await interaction.reply({ content: "Skipped to next song!", ephemeral: true });
      }
      break;
      
    case "music_loop":
      const loopRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("loop_off")
            .setLabel("No Loop")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("loop_song")
            .setLabel("Loop Song")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("loop_queue")
            .setLabel("Loop Queue")
            .setStyle(ButtonStyle.Success)
        );
      
      await interaction.reply({ 
        content: "Select loop mode:", 
        components: [loopRow],
        ephemeral: true 
      });
      break;
      
    case "loop_off":
    case "loop_song":
    case "loop_queue":
      const mode = interaction.customId.split("_")[1];
      const result = musicService.setLoop(interaction.guild, mode);
      
      let message = "";
      if (result === "off") message = "Loop disabled";
      else if (result === "song") message = "Loop mode: Single Song";
      else if (result === "queue") message = "Loop mode: Entire Queue";
      else message = "Cannot loop empty queue! Using song loop instead.";
      
      await interaction.update({ content: message, components: [] });
      
      const updatedSession = musicService.getSession(interaction.guild.id);
      const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
      const updatedRow = createControlButtons(updatedSession);
      
      if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
        await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: [updatedRow] });
      }
      break;
  }
  
  setTimeout(async () => {
    const updatedSession = musicService.getSession(interaction.guild.id);
    if (updatedSession && updatedSession.current) {
      const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
      const updatedRow = createControlButtons(updatedSession);
      
      if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
        await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: [updatedRow] });
      }
    }
  }, 100);
});

// =======================
// START BOT
// =======================
(async () => {
  await registerCommands();
  client.login(TOKEN);
})();