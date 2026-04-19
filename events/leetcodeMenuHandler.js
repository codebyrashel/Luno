const { ChannelType } = require("discord.js");
const leetcodeService = require("../services/leetcodeService");
const { saveLeetcodeSettings, removeLeetcodeSettings } = require("../utils/leetcodeScheduler");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "leetcode_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.leetcodeContext;
        
        if (!context) {
            // Check if interaction is already replied or deferred
            if (!interaction.replied && !interaction.deferred) {
                const msg = await interaction.reply({ 
                    content: "Session expired. Please use /leetcode again.",
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            }
            return true;
        }
        
        try {
            // Try to delete the original message, but don't fail if it's already gone
            try {
                await interaction.message.delete();
            } catch (e) {
                // Message might already be deleted, ignore
            }
        } catch (e) {}
        
        switch (action) {
            case "now":
                // Check if interaction is already replied or deferred
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ flags: 64 });
                }
                
                try {
                    await leetcodeService.sendDailyChallenge(interaction.channel);
                    if (!interaction.replied && !interaction.deferred) {
                        const msg = await interaction.editReply("Today's LeetCode daily challenge has been posted above!");
                        setTimeout(async () => {
                            try {
                                await msg.delete();
                            } catch (e) {}
                        }, 3000);
                    } else {
                        await interaction.followUp({ content: "Today's LeetCode daily challenge has been posted above!", flags: 64 });
                    }
                } catch (error) {
                    if (!interaction.replied && !interaction.deferred) {
                        const msg = await interaction.editReply("Failed to fetch today's daily challenge. Please try again later.");
                        setTimeout(async () => {
                            try {
                                await msg.delete();
                            } catch (e) {}
                        }, 5000);
                    } else {
                        await interaction.followUp({ content: "Failed to fetch today's daily challenge. Please try again later.", flags: 64 });
                    }
                }
                break;
                
            case "setchannel":
                // Check if interaction is already replied or deferred
                if (!interaction.replied && !interaction.deferred) {
                    const channelMsg = await interaction.reply({
                        content: "Please mention the text channel where daily LeetCode problems should be posted:",
                        flags: 64
                    });
                    
                    // Store the channel message for later deletion
                    interaction.client.leetcodeChannelMsg = channelMsg;
                } else {
                    await interaction.followUp({
                        content: "Please mention the text channel where daily LeetCode problems should be posted:",
                        flags: 64
                    });
                }
                
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
                    // Try to delete the original channel message
                    try {
                        if (interaction.client.leetcodeChannelMsg) {
                            await interaction.client.leetcodeChannelMsg.delete();
                        }
                    } catch (e) {}
                });
                break;
                
            case "disable":
                // Check if interaction is already replied or deferred
                if (!interaction.replied && !interaction.deferred) {
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
                } else {
                    leetcodeService.disableDaily(interaction.guild.id);
                    removeLeetcodeSettings(interaction.guild.id);
                    
                    await interaction.followUp({ 
                        content: "Daily LeetCode problems have been disabled!",
                        flags: 64 
                    });
                }
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
                
                // Check if interaction is already replied or deferred
                if (!interaction.replied && !interaction.deferred) {
                    const statusMsg = await interaction.reply({ 
                        content: statusText,
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await statusMsg.delete();
                        } catch (e) {}
                    }, 10000);
                } else {
                    await interaction.followUp({ 
                        content: statusText,
                        flags: 64 
                    });
                }
                break;
        }
        
        delete interaction.client.leetcodeContext;
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    // Check if the interaction is already handled
    if (interaction.replied || interaction.deferred) {
        console.log("Interaction already handled, skipping");
        return false;
    }
    return await handleSelectMenu(interaction);
};