const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { saveLeetcodeSettings, removeLeetcodeSettings } = require("../utils/leetcodeScheduler");

module.exports = {
    data: new SlashCommandBuilder()
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
    execute: async (interaction, leetcodeService) => {
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
    }
};