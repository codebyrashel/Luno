const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const vcTracker = require("../services/vcTrackerService");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "leaderboard_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.leaderboardContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /leaderboard again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const userId = context.userId;
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        switch (action) {
            case "vc":
                // Ask for time range
                const rangeMenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("leaderboard_range_select")
                            .setPlaceholder("Select time range")
                            .addOptions([
                                { label: "Last 24 Hours", value: "24h" },
                                { label: "Last 7 Days", value: "7d" }
                            ])
                    );
                
                await interaction.reply({
                    content: "Select time range for Voice Channel Leaderboard:",
                    components: [rangeMenu],
                    flags: 64
                });
                
                interaction.client.leaderboardRangeContext = {
                    type: "vc"
                };
                
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch (e) {}
                    delete interaction.client.leaderboardRangeContext;
                }, 30000);
                break;
                
            case "level":
                // Show level leaderboard directly
                const weeklyXpData = vcTracker.getWeeklyLeaderboard();
                const resetTime = "Monday 00:00 UTC";
                
                if (!weeklyXpData || weeklyXpData.length === 0) {
                    const msg = await interaction.reply({ 
                        content: "No level data available yet. Start spending time in voice channels to earn XP!",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                let levelText = "Weekly Level Leaderboard (resets Monday 00:00 UTC)\n\n";
                for (let i = 0; i < Math.min(weeklyXpData.length, 10); i++) {
                    const [uid, xp] = weeklyXpData[i];
                    const totalXp = vcTracker.getTotalXp(uid);
                    const level = vcTracker.getLevel(totalXp);
                    levelText += `${i + 1}. <@${uid}> - Level ${level} (${xp} XP this week)\n`;
                }
                
                // Add user's rank if not in top 10
                const userRank = vcTracker.getWeeklyRank(userId);
                if (userRank && userRank > 10) {
                    const userWeeklyXp = vcTracker.getWeeklyXp(userId);
                    levelText += `\nYour rank: #${userRank} (${userWeeklyXp} XP this week)`;
                }
                
                const levelMsg = await interaction.reply({ 
                    content: levelText,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await levelMsg.delete();
                    } catch (e) {}
                }, 20000);
                break;
                
            case "stats":
                // Ask for time range for stats
                const statsRangeMenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("leaderboard_stats_range_select")
                            .setPlaceholder("Select time range")
                            .addOptions([
                                { label: "Last 24 Hours", value: "24h" },
                                { label: "Last 7 Days", value: "7d" }
                            ])
                    );
                
                await interaction.reply({
                    content: "Select time range for your statistics:",
                    components: [statsRangeMenu],
                    flags: 64
                });
                
                interaction.client.leaderboardStatsContext = {
                    userId
                };
                
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch (e) {}
                    delete interaction.client.leaderboardStatsContext;
                }, 30000);
                break;
        }
        
        delete interaction.client.leaderboardContext;
        return true;
    }
    
    if (interaction.customId === "leaderboard_range_select") {
        const range = interaction.values[0];
        const context = interaction.client.leaderboardRangeContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /leaderboard again.",
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
        
        const data = vcTracker.getLeaderboard(range);
        const rangeText = range === "24h" ? "Last 24 Hours" : "Last 7 Days";
        
        if (!data || data.length === 0) {
            const msg = await interaction.reply({ 
                content: `No voice channel data available for ${rangeText}.`,
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 5000);
            return true;
        }
        
        let leaderboardText = `Voice Channel Leaderboard (${rangeText})\n\n`;
        for (let i = 0; i < Math.min(data.length, 10); i++) {
            const [uid, time] = data[i];
            leaderboardText += `${i + 1}. <@${uid}> - ${vcTracker.formatTime(time)}\n`;
        }
        
        const leaderboardMsg = await interaction.reply({ 
            content: leaderboardText,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await leaderboardMsg.delete();
            } catch (e) {}
        }, 20000);
        
        delete interaction.client.leaderboardRangeContext;
        return true;
    }
    
    if (interaction.customId === "leaderboard_stats_range_select") {
        const range = interaction.values[0];
        const context = interaction.client.leaderboardStatsContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /leaderboard again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const userId = context.userId;
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        const time = vcTracker.getTime(userId, range);
        const xp = vcTracker.getXp(userId, range);
        const totalXp = vcTracker.getTotalXp(userId);
        const level = vcTracker.getLevel(totalXp);
        const xpToNext = vcTracker.xpToNextLevel(totalXp);
        const weeklyRank = vcTracker.getWeeklyRank(userId);
        const rangeText = range === "24h" ? "last 24 hours" : "last 7 days";
        
        let statsText = `Your VC Statistics (${rangeText})\n\n`;
        statsText += `Time spent: ${vcTracker.formatTime(time)}\n`;
        statsText += `XP earned: ${xp}\n`;
        statsText += `Total XP: ${totalXp}\n`;
        statsText += `Current level: ${level}\n`;
        statsText += `XP to next level: ${xpToNext}\n`;
        if (weeklyRank) {
            statsText += `Weekly rank: #${weeklyRank}\n`;
        }
        
        const statsMsg = await interaction.reply({ 
            content: statsText,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await statsMsg.delete();
            } catch (e) {}
        }, 15000);
        
        delete interaction.client.leaderboardStatsContext;
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    return await handleSelectMenu(interaction);
};