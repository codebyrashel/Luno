const focusCommand = require("../commands/focus");
const leaderboardCommand = require("../commands/leaderboard");
const goalCommand = require("../commands/goal");
const smartVCCommand = require("../commands/smartvc");
const musicCommands = require("../commands/music");
const leetcodeCommand = require("../commands/leetcode");

const commands = {
  focus: focusCommand,
  leaderboard: leaderboardCommand,
  goal: goalCommand,
  smartvc: smartVCCommand,
  play: musicCommands,
  leetcode: leetcodeCommand,
};

module.exports = async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];
  if (!command) return;

  try {
    if (interaction.commandName === "play") {
      const musicService = require("../services/musicService");
      await command.execute(interaction, musicService);
    } 
    else if (interaction.commandName === "leetcode") {
      const leetcodeService = require("../services/leetcodeService");
      await command.execute(interaction, leetcodeService);
    }
    else {
      await command.execute(interaction);
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply("Something broke.");
    } else {
      interaction.reply({ content: "Something broke.", flags: 64 });
    }
  }
};