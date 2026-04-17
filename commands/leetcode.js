const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const leetcodeService = require("../services/leetcodeService");
const { saveLeetcodeSettings, removeLeetcodeSettings } = require("../utils/leetcodeScheduler");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leetcode")
        .setDescription("LeetCode daily challenge management"),

    async execute(interaction) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("leetcode_action_select")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Get Today's Challenge",
                    description: "View today's LeetCode daily problem",
                    value: "now"
                },
                {
                    label: "Set Daily Channel",
                    description: "Set channel for automatic daily problems",
                    value: "setchannel"
                },
                {
                    label: "Disable Daily Posts",
                    description: "Stop automatic daily problem posts",
                    value: "disable"
                },
                {
                    label: "Check Status",
                    description: "See current LeetCode settings",
                    value: "status"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "LeetCode System\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        interaction.client.leetcodeContext = {
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.leetcodeContext;
        }, 30000);
    }
};