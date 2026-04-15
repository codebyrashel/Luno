const focusCommand = require("../commands/focus");
const leaderboardCommand = require("../commands/leaderboard");
const goalCommand = require("../commands/goal");
const smartVCCommand = require("../commands/smartvc");

const commands = {
  focus: focusCommand,
  leaderboard: leaderboardCommand,
  goal: goalCommand,
  smartvc: smartVCCommand,
};

module.exports = async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      interaction.editReply("Something broke.");
    } else {
      interaction.reply("Something broke.");
    }
  }
};