const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const devTrackerService = require("../services/devTrackerService");

async function deleteAfter(msg, seconds = 3) {
    setTimeout(async () => {
        try {
            await msg.delete();
        } catch (e) {}
    }, seconds * 1000);
}

module.exports = async (interaction) => {
    // Handle the select menu
    if (interaction.isStringSelectMenu() && interaction.customId === "devtracker_menu") {
        const action = interaction.values[0];
        
        if (action === "register") {
            const modal = new ModalBuilder()
                .setCustomId("devtracker_register")
                .setTitle("Register GitHub Account");
            
            const githubInput = new TextInputBuilder()
                .setCustomId("github_username")
                .setLabel("GitHub Username")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Enter your GitHub username")
                .setRequired(true);
            
            const row = new ActionRowBuilder().addComponents(githubInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
            return true;
        }
        
        if (action === "stats") {
            // Stats should be public - remove ephemeral flag
            await interaction.deferReply();
            
            const userProfile = devTrackerService.getUserProfile(interaction.user.id);
            
            if (!userProfile || !userProfile.github) {
                const msg = await interaction.editReply("No GitHub profile registered. Use 'Register GitHub' first.");
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 5000);
                return true;
            }
            
            const stats = await devTrackerService.fetchUserStats(interaction.user.id, userProfile);
            const formattedStats = devTrackerService.formatUserStats(stats);
            
            await interaction.editReply(formattedStats);
            return true;
        }
        
        if (action === "leaderboard") {
            // Leaderboard should be public
            await interaction.deferReply();
            
            const leaderboard = await devTrackerService.getLeaderboard();
            
            if (leaderboard.length === 0) {
                const msg = await interaction.editReply("No users registered yet. Be the first to register!");
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 5000);
                return true;
            }
            
            let output = "** Weekly GitHub Leaderboard **\n\n";
            for (let i = 0; i < leaderboard.length; i++) {
                const user = leaderboard[i];
                output += `${i + 1}. <@${user.userId}> - ${user.commitsWeek} commits this week\n`;
            }
            
            await interaction.editReply(output);
            return true;
        }
        
        if (action === "setchannel") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                const msg = await interaction.reply({ content: "You need Manage Server permission to set channels.", flags: 64 });
                await deleteAfter(msg);
                return true;
            }
            
            const channelMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("devtracker_channel_select")
                        .setPlaceholder("Select channel type")
                        .addOptions([
                            { label: "Report Channel", description: "For reminders and shame messages", value: "reportChannel" },
                            { label: "Tracker Channel", description: "For daily stats reports", value: "trackerChannel" }
                        ])
                );
            
            const msg = await interaction.reply({
                content: "Select which channel you want to set:",
                components: [channelMenu],
                flags: 64
            });
            await deleteAfter(msg, 30);
            return true;
        }
        
        if (action === "status") {
            const reportChannelId = devTrackerService.getReportChannel(interaction.guild.id, "reportChannel");
            const trackerChannelId = devTrackerService.getReportChannel(interaction.guild.id, "trackerChannel");
            const reportChannel = reportChannelId ? interaction.guild.channels.cache.get(reportChannelId) : null;
            const trackerChannel = trackerChannelId ? interaction.guild.channels.cache.get(trackerChannelId) : null;
            
            let statusText = "** Developer Tracker Status **\n\n";
            statusText += `Report Channel (Reminders & Shame): ${reportChannel ? reportChannel : "Not set"}\n`;
            statusText += `Tracker Channel (Daily Stats): ${trackerChannel ? trackerChannel : "Not set"}\n`;
            statusText += `Reminder Times: 9 AM, 12 PM, 5 PM, 8 PM\n`;
            statusText += `Daily Report Time: 12 AM UTC\n`;
            statusText += `\nNote: GitHub API may take 30-60 minutes to show new commits.`;
            
            const msg = await interaction.reply({ content: statusText, flags: 64 });
            await deleteAfter(msg, 15);
            return true;
        }
        
        return true;
    }
    
    // Handle channel selection menu
    if (interaction.isStringSelectMenu() && interaction.customId === "devtracker_channel_select") {
        const channelType = interaction.values[0];
        
        await interaction.deferUpdate();
        
        const replyMsg = await interaction.followUp({
            content: `Please mention the text channel for ${channelType === "reportChannel" ? "reminders and shame messages" : "daily stats reports"}:`,
            flags: 64
        });
        
        const filter = (m) => m.author.id === interaction.user.id && m.mentions.channels.size > 0;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
        
        collector.on("collect", async (message) => {
            const channel = message.mentions.channels.first();
            
            if (channel.type !== ChannelType.GuildText) {
                const errorMsg = await interaction.followUp({ content: "Please select a text channel!", flags: 64 });
                await deleteAfter(errorMsg);
                return;
            }
            
            devTrackerService.setReportChannel(interaction.guild.id, channel.id, channelType);
            const successMsg = await interaction.followUp({ content: `${channelType === "reportChannel" ? "Report channel" : "Tracker channel"} set to ${channel}!`, flags: 64 });
            await deleteAfter(successMsg);
            
            try {
                await message.delete();
            } catch (e) {}
        });
        
        collector.on("end", async (collected) => {
            if (collected.size === 0) {
                const timeoutMsg = await interaction.followUp({ content: "Channel selection timed out. Please use /devtracker again.", flags: 64 });
                await deleteAfter(timeoutMsg);
            }
            await deleteAfter(replyMsg);
        });
        
        return true;
    }
    
    // Handle the modal submission
    if (interaction.isModalSubmit() && interaction.customId === "devtracker_register") {
        const github = interaction.fields.getTextInputValue("github_username");
        
        devTrackerService.registerUser(interaction.user.id, github);
        
        const msg = await interaction.reply({ 
            content: `Registered GitHub: ${github}\n\nUse /devtracker again and select "View My Stats" to see your activity.\n\nNote: GitHub API may take 30-60 minutes to show new commits.`,
            flags: 64 
        });
        await deleteAfter(msg, 8);
        return true;
    }
    
    return false;
};