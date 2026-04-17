const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const focusService = require("../services/focusService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("focus")
        .setDescription("Focus session management"),

    async execute(interaction) {
        const userId = interaction.user.id;
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("focus_action_select")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Start Focus Session",
                    description: "Start a new focus session",
                    value: "start"
                },
                {
                    label: "Stop Focus Session",
                    description: "Stop your current focus session",
                    value: "stop"
                },
                {
                    label: "Check Session Status",
                    description: "See remaining time for current session",
                    value: "status"
                },
                {
                    label: "View Your Stats",
                    description: "See your focus statistics",
                    value: "stats"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "Focus System\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        interaction.client.focusContext = {
            userId,
            member,
            voiceChannel,
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.focusContext;
        }, 30000);
    }
};