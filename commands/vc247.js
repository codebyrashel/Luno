const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const vc247Service = require("../services/vc247Service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vc247")
    .setDescription("Enable or disable 24/7 persistent voice mode")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Enable, disable, or view status")
        .setRequired(true)
        .addChoices(
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
          { name: "Status", value: "status" }
        )
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Voice channel to keep the bot in")
        .addChannelTypes(ChannelType.GuildVoice)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = await interaction.reply({
        content: "You need Manage Server permission to use this command.",
        flags: 64,
      });
      setTimeout(async () => {
        try {
          await msg.delete();
        } catch (e) {}
      }, 3000);
      return;
    }

    const action = interaction.options.getString("action");
    const guild = interaction.guild;

    if (action === "enable") {
      const channel = interaction.options.getChannel("channel") || interaction.member.voice.channel;
      if (!channel) {
        const msg = await interaction.reply({
          content: "Please join a voice channel or specify one to enable 24/7 mode.",
          flags: 64,
        });
        setTimeout(async () => {
          try {
            await msg.delete();
          } catch (e) {}
        }, 3000);
        return;
      }

      try {
        vc247Service.setChannel(guild.id, channel.id);
        vc247Service.connect(guild, channel);

        const msg = await interaction.reply({
          content: `24/7 voice mode enabled for **${channel.name}**. The bot will remain in voice until you disable it or disconnect it manually.`,
          flags: 64,
        });
        setTimeout(async () => {
          try {
            await msg.delete();
          } catch (e) {}
        }, 10000);
      } catch (error) {
        console.error(error);
        const msg = await interaction.reply({
          content: "Failed to enable 24/7 voice mode. Please make sure I have permission to join that channel.",
          flags: 64,
        });
        setTimeout(async () => {
          try {
            await msg.delete();
          } catch (e) {}
        }, 5000);
      }
      return;
    }

    if (action === "disable") {
      const config = vc247Service.getStatus(guild.id);
      if (!config || !config.enabled) {
        const msg = await interaction.reply({
          content: "24/7 voice mode is not enabled for this server.",
          flags: 64,
        });
        setTimeout(async () => {
          try {
            await msg.delete();
          } catch (e) {}
        }, 3000);
        return;
      }

      vc247Service.disable(guild.id);
      const connection = getVoiceConnection(guild.id);
      if (connection) {
        connection.destroy();
      }

      const msg = await interaction.reply({
        content: "24/7 voice mode has been disabled and the bot has left the voice channel.",
        flags: 64,
      });
      setTimeout(async () => {
        try {
          await msg.delete();
        } catch (e) {}
      }, 10000);
      return;
    }

    if (action === "status") {
      const config = vc247Service.getStatus(guild.id);
      if (!config || !config.enabled) {
        const msg = await interaction.reply({
          content: "24/7 voice mode is currently disabled for this server.",
          flags: 64,
        });
        setTimeout(async () => {
          try {
            await msg.delete();
          } catch (e) {}
        }, 5000);
        return;
      }

      const channel = guild.channels.cache.get(config.channelId);
      const channelName = channel ? channel.name : "Unknown channel";
      const statusMsg = await interaction.reply({
        content: `24/7 voice mode is enabled for **${channelName}**.
The bot will stay in that voice channel until you disable it or disconnect it manually.`,
        flags: 64,
      });
      setTimeout(async () => {
        try {
          await statusMsg.delete();
        } catch (e) {}
      }, 15000);
      return;
    }
  },
};
