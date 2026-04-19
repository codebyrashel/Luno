const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");
const devTrackerService = require("../services/devTrackerService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("devtracker")
        .setDescription("Developer activity tracker for GitHub, LeetCode, Codeforces"),

    async execute(interaction) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("devtracker_action_select")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Register Profile",
                    description: "Link your GitHub/LeetCode/Codeforces accounts",
                    value: "register"
                },
                {
                    label: "View My Stats",
                    description: "See your current developer statistics",
                    value: "stats"
                },
                {
                    label: "Set Channels",
                    description: "Set report and tracker channels (Admin only)",
                    value: "setchannel"
                },
                {
                    label: "Disable Reports",
                    description: "Stop daily reports (Admin only)",
                    value: "disable"
                },
                {
                    label: "Check Status",
                    description: "See current report settings",
                    value: "status"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "Developer Tracker System\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        interaction.client.devTrackerContext = {
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.devTrackerContext;
        }, 30000);
    }
};