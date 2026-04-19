// =======================
// IMPORTS
// =======================
require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const fs = require("fs");

const interactionHandler = require("./events/interactionHandler");
const buttonHandler = require("./events/buttonHandler");
const selectMenuHandler = require("./events/selectMenuHandler");
const focusMenuHandler = require("./events/focusMenuHandler");
const goalMenuHandler = require("./events/goalMenuHandler");
const leaderboardMenuHandler = require("./events/leaderboardMenuHandler");
const leetcodeMenuHandler = require("./events/leetcodeMenuHandler");
const smartvcMenuHandler = require("./events/smartvcMenuHandler");
const voiceHandler = require("./events/voiceHandler");
const { startFocusWatcher, startGoalWatcher } = require("./utils/time");
const { loadLeetcodeSettings, scheduleDailyChallenge } = require("./utils/leetcodeScheduler");
const vcTracker = require("./services/vcTrackerService");
const smartVCService = require("./services/smartVCService");
const musicService = require("./services/musicService");
const leetcodeService = require("./services/leetcodeService");
const focusCommand = require("./commands/focus");
const leaderboardCommand = require("./commands/leaderboard");
const goalCommand = require("./commands/goal");
const smartVCCommand = require("./commands/smartvc");
const musicCommands = require("./commands/music");
const leetcodeCommand = require("./commands/leetcode");

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
// COMMAND REGISTRATION
// =======================
const commands = [
    musicCommands.data,
    leetcodeCommand.data,
    focusCommand.data,
    leaderboardCommand.data,
    goalCommand.data,
    smartVCCommand.data,
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log(`Registered ${commands.length} slash commands`);
    } catch (error) {
        console.error("Error registering commands:", error);
    }
}

// =======================
// READY EVENT
// =======================
client.once("clientReady", () => {
    console.log(`Logged in as ${client.user.tag}`);
    startFocusWatcher(client);
    startGoalWatcher(client);
    loadLeetcodeSettings(leetcodeService);
    scheduleDailyChallenge(client, leetcodeService);
});

// =======================
// VOICE STATE UPDATE
// =======================
client.on("voiceStateUpdate", (oldState, newState) => {
    voiceHandler(oldState, newState, vcTracker, smartVCService, musicService, client);
});

// =======================
// INTERACTION CREATE
// =======================
client.on("interactionCreate", async (interaction) => {
    // Handle smartvc menu interactions
    const isSmartvcMenuHandled = await smartvcMenuHandler(interaction);
    if (isSmartvcMenuHandled) return;
    
    // Handle leetcode menu interactions
    const isLeetcodeMenuHandled = await leetcodeMenuHandler(interaction);
    if (isLeetcodeMenuHandled) return;
    
    // Handle leaderboard menu interactions
    const isLeaderboardMenuHandled = await leaderboardMenuHandler(interaction);
    if (isLeaderboardMenuHandled) return;
    
    // Handle goal menu interactions
    const isGoalMenuHandled = await goalMenuHandler(interaction);
    if (isGoalMenuHandled) return;
    
    // Handle focus menu interactions
    const isFocusMenuHandled = await focusMenuHandler(interaction);
    if (isFocusMenuHandled) return;
    
    // Handle queue select menu
    const isSelectMenuHandled = await selectMenuHandler(interaction, musicService);
    if (isSelectMenuHandled) return;
    
    // Handle music control buttons
    const isButtonHandled = await buttonHandler(interaction, musicService);
    if (isButtonHandled) return;
    
    // Handle all other slash commands
    await interactionHandler(interaction);
});

// =======================
// START BOT
// =======================
(async () => {
    await registerCommands();
    client.login(TOKEN);
})();