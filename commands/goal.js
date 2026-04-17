const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const goalService = require("../services/goalService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("goal")
        .setDescription("Goal accountability system"),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("goal_action_select")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Set New Goal",
                    description: "Create a new accountability goal",
                    value: "set"
                },
                {
                    label: "Check Goal Status",
                    description: "View your active goal progress",
                    value: "status"
                },
                {
                    label: "Update Progress",
                    description: "Log progress on your active goal",
                    value: "update"
                },
                {
                    label: "Complete Goal",
                    description: "Mark your active goal as complete",
                    value: "complete"
                },
                {
                    label: "Cancel Goal",
                    description: "Cancel your active goal",
                    value: "cancel"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "Goal Accountability System\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        interaction.client.goalContext = {
            userId,
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.goalContext;
        }, 30000);
    }
};