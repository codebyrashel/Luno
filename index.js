// =======================
// IMPORTS
// =======================
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType } = require("discord.js");
const {
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  joinVoiceChannel,
  getVoiceConnection,
} = require("@discordjs/voice");
const { spawn } = require("child_process");

const interactionHandler = require("./events/interactionHandler");
const { startFocusWatcher, startGoalWatcher } = require("./utils/time");
const vcTracker = require("./services/vcTrackerService");
const smartVCService = require("./services/smartVCService");
// const leaderboardCommand = require("./commands/leaderboard"); // REMOVED - now handled by interactionHandler

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
        .setDescription("YouTube URL")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop and disconnect bot"),

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
// YT-DLP STREAM
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
// READY
// =======================
client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  startFocusWatcher(client);
  startGoalWatcher(client);
});

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
});

// =======================
// INTERACTIONS
// =======================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // -------------------
  // MUSIC
  // -------------------
  if (interaction.commandName === "play") {
    await interaction.deferReply();

    const url = interaction.options.getString("url");
    if (!url) return interaction.editReply("No URL provided.");

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply("Join a voice channel first.");
    }

    let connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
    }

    try {
      const stream = getAudioStream(url);
      const resource = createAudioResource(stream);

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      player.play(resource);
      connection.subscribe(player);

      await interaction.editReply("Playing audio");
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to play video.");
    }
    return;
  }

  if (interaction.commandName === "stop") {
    await interaction.deferReply();

    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      return interaction.editReply("Not connected.");
    }

    connection.destroy();
    await interaction.editReply("Disconnected");
    return;
  }

  // -------------------
  // MODULAR (FOCUS, LEADERBOARD etc)
  // -------------------
  await interactionHandler(interaction);
});

// =======================
// START BOT
// =======================
(async () => {
  await registerCommands();
  client.login(TOKEN);
})();