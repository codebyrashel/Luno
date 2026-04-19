const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const devTrackerService = require("../services/devTrackerService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("devtracker")
        .setDescription("GitHub activity tracker"),

    async execute(interaction) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("devtracker_menu")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Register GitHub",
                    description: "Link your GitHub account",
                    value: "register"
                },
                {
                    label: "View My Stats",
                    description: "See your GitHub activity",
                    value: "stats"
                },
                {
                    label: "Leaderboard",
                    description: "Top contributors this week",
                    value: "leaderboard"
                },
                {
                    label: "Set Channels",
                    description: "Admin only - Set report and tracker channels",
                    value: "setchannel"
                },
                {
                    label: "Check Status",
                    description: "See current settings",
                    value: "status"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // Main menu is ephemeral so it doesn't clutter the channel
        await interaction.reply({
            content: "GitHub Activity Tracker\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        const reply = await interaction.fetchReply();
        setTimeout(async () => {
            try {
                await reply.delete();
            } catch (e) {}
        }, 30000);
    }
};