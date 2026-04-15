const { SlashCommandBuilder } = require("discord.js");
const focusService = require("../services/focusService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("focus")
    .setDescription("Focus system")
    .addSubcommand(cmd =>
      cmd.setName("start")
        .setDescription("Start focus session")
        .addIntegerOption(opt =>
          opt.setName("minutes")
            .setDescription("Duration in minutes")
            .setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("stop")
        .setDescription("Stop focus session")
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Check focus status")
    )

    .addSubcommand(cmd =>
      cmd.setName("stats")
        .setDescription("Show your focus stats")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    // START
    if (sub === "start") {
      const duration = interaction.options.getInteger("minutes");

      if (!voiceChannel) {
        return interaction.reply("Join a voice channel first.");
      }

      if (focusService.isInSession(userId)) {
        return interaction.reply("You already have an active session.");
      }

      const endTime = focusService.startSession(
        userId,
        duration,
        voiceChannel.id
      );

      // MUTE USER
      try {
        await member.voice.setMute(true);
      } catch (err) {
        console.log("Mute failed");
      }

      return interaction.reply(
        `Focus started for ${duration} minutes. Ends at ${new Date(endTime).toLocaleTimeString()}`
      );
    }

    // STOP
    if (sub === "stop") {
      if (!focusService.isInSession(userId)) {
        return interaction.reply("No active session.");
      }

      focusService.endSession(userId);

      try {
        await member.voice.setMute(false);
      } catch (err) {
        console.log("Unmute failed");
      }

      return interaction.reply("Session stopped.");
    }

    // STATUS
    if (sub === "status") {
      const session = focusService.getSession(userId);

      if (!session) {
        return interaction.reply("No active session.");
      }

      const remainingMs = session.endTime - Date.now();
      const minutes = Math.max(0, Math.floor(remainingMs / 60000));

      return interaction.reply(`Remaining time: ${minutes} minutes`);
    }



    if (sub === "stats") {
  const stats = focusService.getUserStats(userId);

  const last24 = focusService.formatTime(stats.last24);
  const last7 = focusService.formatTime(stats.last7);
  const total = focusService.formatTime(stats.total);

  return interaction.reply(
    `Your focus stats:\n\nLast 24h: ${last24}\nLast 7 days: ${last7}\nTotal: ${total}`
  );
}

  }
};