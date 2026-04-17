const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const vcTracker = require("../services/vcTrackerService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("View leaderboards for VC activity and levels"),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("leaderboard_action_select")
            .setPlaceholder("Select a leaderboard")
            .addOptions([
                {
                    label: "Voice Channel Leaderboard",
                    description: "Top users by VC time (24h or 7d)",
                    value: "vc"
                },
                {
                    label: "Level Leaderboard",
                    description: "Top users by XP and level",
                    value: "level"
                },
                {
                    label: "Your Stats",
                    description: "View your personal VC statistics",
                    value: "stats"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "Leaderboard System\nSelect a leaderboard to view:",
            components: [row],
            flags: 64
        });
        
        interaction.client.leaderboardContext = {
            userId,
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.leaderboardContext;
        }, 30000);
    }
};