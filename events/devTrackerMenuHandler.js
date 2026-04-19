const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");
const devTrackerService = require("../services/devTrackerService");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "devtracker_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.devTrackerContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /devtracker again.",
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
            case "register":
                const modal = new ModalBuilder()
                    .setCustomId("devtracker_register_modal")
                    .setTitle("Register Developer Profiles");
                
                const githubInput = new TextInputBuilder()
                    .setCustomId("github_username")
                    .setLabel("GitHub Username")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Enter your GitHub username")
                    .setRequired(false);
                
                const leetcodeInput = new TextInputBuilder()
                    .setCustomId("leetcode_username")
                    .setLabel("LeetCode Username")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Enter your LeetCode username (optional)")
                    .setRequired(false);
                
                const codeforcesInput = new TextInputBuilder()
                    .setCustomId("codeforces_username")
                    .setLabel("Codeforces Handle")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Enter your Codeforces handle (optional)")
                    .setRequired(false);
                
                const row1 = new ActionRowBuilder().addComponents(githubInput);
                const row2 = new ActionRowBuilder().addComponents(leetcodeInput);
                const row3 = new ActionRowBuilder().addComponents(codeforcesInput);
                modal.addComponents(row1, row2, row3);
                
                await interaction.showModal(modal);
                break;
                
            case "stats":
                await interaction.deferReply({ flags: 64 });
                
                const userProfile = devTrackerService.getUserProfile(interaction.user.id);
                
                if (!userProfile || (!userProfile.github && !userProfile.leetcode && !userProfile.codeforces)) {
                    const msg = await interaction.editReply("No registered profiles found. Use 'Register Profile' to add your accounts.");
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const stats = await devTrackerService.fetchUserStats(interaction.user.id, userProfile);
                const formattedStats = devTrackerService.formatUserStats(stats);
                
                const msg = await interaction.editReply(formattedStats);
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 20000);
                break;
                
            case "setchannel":
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    const errorMsg = await interaction.reply({ 
                        content: "You need Manage Server permission to set channels.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await errorMsg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                const channelMenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("devtracker_channel_select")
                            .setPlaceholder("Select channel type")
                            .addOptions([
                                { label: "Report Channel", description: "Channel for reminders and shame messages", value: "reportChannel" },
                                { label: "Tracker Channel", description: "Channel for daily stats tracking", value: "trackerChannel" }
                            ])
                    );
                
                await interaction.reply({
                    content: "Select which channel you want to set:",
                    components: [channelMenu],
                    flags: 64
                });
                break;
                
            case "disable":
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    const errorMsg = await interaction.reply({ 
                        content: "You need Manage Server permission to disable reports.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await errorMsg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                const currentConfig = devTrackerService.getReportChannel(interaction.guild.id, "reportChannel");
                
                if (!currentConfig) {
                    const alreadyMsg = await interaction.reply({ 
                        content: "Daily developer reports are already disabled.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await alreadyMsg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                devTrackerService.setReportChannel(interaction.guild.id, null, "reportChannel");
                devTrackerService.setReportChannel(interaction.guild.id, null, "trackerChannel");
                
                const disableMsg = await interaction.reply({ 
                    content: "Daily developer reports have been disabled.",
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await disableMsg.delete();
                    } catch (e) {}
                }, 5000);
                break;
                
            case "status":
                const reportChannelId = devTrackerService.getReportChannel(interaction.guild.id, "reportChannel");
                const trackerChannelId = devTrackerService.getReportChannel(interaction.guild.id, "trackerChannel");
                const reportChannel = reportChannelId ? interaction.guild.channels.cache.get(reportChannelId) : null;
                const trackerChannel = trackerChannelId ? interaction.guild.channels.cache.get(trackerChannelId) : null;
                
                let statusText = "Developer Tracker Status\n\n";
                statusText += `Report Channel: ${reportChannel ? reportChannel.name : "Not set"}\n`;
                statusText += `Tracker Channel: ${trackerChannel ? trackerChannel.name : "Not set"}\n`;
                statusText += `Reminder Times: 9 AM, 12 PM, 5 PM, 8 PM (local time)\n`;
                statusText += `Daily Report Time: 00:00 UTC\n`;
                
                if (!reportChannel && !trackerChannel) {
                    statusText += "\nUse 'Set Channels' to enable daily reports and reminders.";
                }
                
                const statusMsg = await interaction.reply({ 
                    content: statusText,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statusMsg.delete();
                    } catch (e) {}
                }, 15000);
                break;
        }
        
        delete interaction.client.devTrackerContext;
        return true;
    }
    
    if (interaction.customId === "devtracker_channel_select") {
        const channelType = interaction.values[0];
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        const channelMsg = await interaction.reply({
            content: `Please mention the text channel for ${channelType === "reportChannel" ? "reminders and shame messages" : "daily stats tracking"}:`,
            flags: 64
        });
        
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
            
            devTrackerService.setReportChannel(interaction.guild.id, channel.id, channelType);
            
            const successMsg = await interaction.followUp({ 
                content: `${channelType === "reportChannel" ? "Report channel" : "Tracker channel"} set to ${channel}!`,
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
                    content: "Channel selection timed out. Please use /devtracker again.",
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
        
        return true;
    }
    
    return false;
}

async function handleModal(interaction) {
    if (!interaction.isModalSubmit()) return false;
    
    if (interaction.customId === "devtracker_register_modal") {
        const github = interaction.fields.getTextInputValue("github_username") || null;
        const leetcode = interaction.fields.getTextInputValue("leetcode_username") || null;
        const codeforces = interaction.fields.getTextInputValue("codeforces_username") || null;
        
        if (!github && !leetcode && !codeforces) {
            const msg = await interaction.reply({ 
                content: "Please provide at least one username to register.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        if (github) {
            devTrackerService.registerUser(interaction.user.id, "github", github);
        }
        if (leetcode) {
            devTrackerService.registerUser(interaction.user.id, "leetcode", leetcode);
        }
        if (codeforces) {
            devTrackerService.registerUser(interaction.user.id, "codeforces", codeforces);
        }
        
        let successMsg = "Profiles registered successfully!\n\n";
        if (github) successMsg += `GitHub: ${github}\n`;
        if (leetcode) successMsg += `LeetCode: ${leetcode}\n`;
        if (codeforces) successMsg += `Codeforces: ${codeforces}\n`;
        successMsg += "\nUse /devtracker stats to view your activity.";
        
        const msg = await interaction.reply({ 
            content: successMsg,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 8000);
        
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    if (interaction.isModalSubmit()) {
        return await handleModal(interaction);
    }
    return await handleSelectMenu(interaction);
};