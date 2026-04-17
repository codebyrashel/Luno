const { ChannelType } = require("discord.js");
const leetcodeService = require("../services/leetcodeService");
const { saveLeetcodeSettings, removeLeetcodeSettings } = require("../utils/leetcodeScheduler");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "leetcode_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.leetcodeContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /leetcode again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        switch (action) {
            case "now":
                await interaction.deferReply({ flags: 64 });
                
                try {
                    await leetcodeService.sendDailyChallenge(interaction.channel);
                    const msg = await interaction.editReply("Today's LeetCode daily challenge has been posted above!");
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                } catch (error) {
                    const msg = await interaction.editReply("Failed to fetch today's daily challenge. Please try again later.");
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                }
                break;
                
            case "setchannel":
                // Ask for channel selection
                const channelMsg = await interaction.reply({
                    content: "Please mention the text channel where daily LeetCode problems should be posted:",
                    flags: 64
                });
                
                // Create a channel collector
                const filter = (m) => m.author.id === interaction.user.id && m.mentions.channels.size > 0;
                const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                
                collector.on("collect", async (message) => {
                    const channel = message.mentions.channels.first();
                    
                    if (channel.type !== ChannelType.GuildText) {
                        const errorMsg = await interaction.followUp({ 
                            content: "Please select a text channel!",
                            flags: 64 
                        });
                        setTimeout(async () => {
                            try {
                                await errorMsg.delete();
                            } catch (e) {}
                        }, 3000);
                        return;
                    }
                    
                    leetcodeService.setDailyChannel(interaction.guild.id, channel.id);
                    saveLeetcodeSettings(interaction.guild.id, channel.id);
                    
                    const successMsg = await interaction.followUp({ 
                        content: `Daily LeetCode problems will be sent to ${channel}!`,
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await successMsg.delete();
                        } catch (e) {}
                    }, 5000);
                    
                    try {
                        await message.delete();
                    } catch (e) {}
                });
                
                collector.on("end", async (collected) => {
                    if (collected.size === 0) {
                        const timeoutMsg = await interaction.followUp({ 
                            content: "Channel selection timed out. Please use /leetcode again.",
                            flags: 64 
                        });
                        setTimeout(async () => {
                            try {
                                await timeoutMsg.delete();
                            } catch (e) {}
                        }, 3000);
                    }
                    try {
                        await channelMsg.delete();
                    } catch (e) {}
                });
                break;
                
            case "disable":
                leetcodeService.disableDaily(interaction.guild.id);
                removeLeetcodeSettings(interaction.guild.id);
                
                const disableMsg = await interaction.reply({ 
                    content: "Daily LeetCode problems have been disabled!",
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await disableMsg.delete();
                    } catch (e) {}
                }, 3000);
                break;
                
            case "status":
                const isEnabled = leetcodeService.isDailyEnabled(interaction.guild.id);
                const channelId = leetcodeService.getDailyChannel(interaction.guild.id);
                const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
                
                let statusText = "LeetCode Daily Challenge Status\n\n";
                if (isEnabled && channel) {
                    statusText += `Status: Enabled\n`;
                    statusText += `Channel: ${channel.name}\n`;
                    statusText += `Daily post time: 00:00 UTC`;
                } else {
                    statusText += "Status: Disabled\n";
                    statusText += "Use 'Set Daily Channel' to enable automatic daily posts.";
                }
                
                const statusMsg = await interaction.reply({ 
                    content: statusText,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statusMsg.delete();
                    } catch (e) {}
                }, 10000);
                break;
        }
        
        delete interaction.client.leetcodeContext;
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    return await handleSelectMenu(interaction);
};