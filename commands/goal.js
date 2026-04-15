const { SlashCommandBuilder } = require("discord.js");
const goalService = require("../services/goalService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("goal")
    .setDescription("Goal accountability system")
    .addSubcommand(cmd =>
      cmd.setName("set")
        .setDescription("Set a new goal")
        .addStringOption(opt =>
          opt.setName("description")
            .setDescription("What is your goal?")
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName("days")
            .setDescription("How many days until due?")
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
            .setDescription("What progress did you make?")
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

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (sub === "set") {
      const description = interaction.options.getString("description");
      const days = interaction.options.getInteger("days");
      const result = goalService.createGoal(userId, guildId, channelId, description, days);

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      return interaction.reply(
        `🎯 Goal set: **${description}**\n` +
        `Due in ${days} day${days === 1 ? "" : "s"}. I will remind you 5 times per day and ask for progress 3 times daily.`
      );
    }

    if (sub === "status") {
      const { goal, streak } = goalService.getGoalStatus(userId);
      if (!goal) {
        return interaction.reply("You have no active goal right now.");
      }

      const due = new Date(goal.dueAt);
      return interaction.reply(
        `📌 Active goal: **${goal.description}**\n` +
        `Due: ${due.toUTCString()} UTC\n` +
        `Updates logged: ${goal.updates.length}\n` +
        `Current streak: ${streak.current}, Best streak: ${streak.best}`
      );
    }

    if (sub === "update") {
      const progress = interaction.options.getString("progress");
      const result = goalService.updateGoal(userId, progress);
      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      const message = `✅ Progress recorded for <@${userId}>:\n` +
        `*${progress}*\n` +
        `Keep the momentum. This update is logged and celebrated.`;

      await interaction.reply(message);
      return;
    }

    if (sub === "complete") {
      const result = goalService.completeGoal(userId);
      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      const streak = goalService.getStreak(userId);
      return interaction.reply(
        `🏆 Incredible work! You completed your goal: **${result.goal.description}**\n` +
        `Streak: ${streak.current} (best: ${streak.best})\n` +
        `You earned glory and the bot logged the completion.`
      );
    }

    if (sub === "cancel") {
      const result = goalService.cancelGoal(userId);
      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      return interaction.reply(`⚠️ Your active goal has been cancelled: **${result.goal.description}**`);
    }

    return interaction.reply({ content: "Unknown goal subcommand.", ephemeral: true });
  },
};