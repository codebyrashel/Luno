const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const smartVCService = require("../services/smartVCService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("smartvc")
    .setDescription("Configure smart VC enforcement for a meeting channel")
    .addSubcommand(cmd =>
      cmd.setName("set")
        .setDescription("Set the enforced voice channel and optional mic requirement")
        .addChannelOption(opt =>
          opt.setName("channel")
            .setDescription("Select the voice channel to enforce")
            .setRequired(true)
            .addChannelTypes(2)
        )
        .addBooleanOption(opt =>
          opt.setName("requiremic")
            .setDescription("Require microphone activity for the channel")
            .setRequired(false)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName("status")
        .setDescription("Show current smart VC settings")
    )
    .addSubcommand(cmd =>
      cmd.setName("disable")
        .setDescription("Disable smart VC enforcement")
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "You need Manage Server permission to configure smart VC.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === "set") {
      const channel = interaction.options.getChannel("channel");
      const requireMic = interaction.options.getBoolean("requiremic") || false;
      const config = smartVCService.setChannel(guildId, channel.id, requireMic);

      return interaction.reply(
        `✅ Smart VC enforcement enabled for <#${channel.id}>.\n` +
        `• Camera required within 30 seconds after joining\n` +
        `• ${requireMic ? "Microphone activity required" : "Microphone optional"}\n` +
        `• Silent lurkers will be removed automatically`
      );
    }

    if (sub === "status") {
      const config = smartVCService.getStatus(guildId);
      if (!config || !config.enabled) {
        return interaction.reply("Smart VC enforcement is not configured for this server.");
      }

      return interaction.reply(
        `🎥 Smart VC channel: <#${config.channelId}>\n` +
        `• Camera required: yes\n` +
        `• Microphone required: ${config.requireMic ? "yes" : "no"}\n` +
        `• Enforced channel ID: ${config.channelId}`
      );
    }

    if (sub === "disable") {
      const config = smartVCService.disable(guildId);
      if (!config) {
        return interaction.reply("Smart VC enforcement is not configured for this server.");
      }

      return interaction.reply("✅ Smart VC enforcement has been disabled.");
    }

    return interaction.reply({ content: "Unknown smart VC subcommand.", ephemeral: true });
  },
};