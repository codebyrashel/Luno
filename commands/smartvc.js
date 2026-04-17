const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");
const smartVCService = require("../services/smartVCService");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("smartvc")
        .setDescription("Smart VC enforcement for meeting channels"),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const msg = await interaction.reply({ 
                content: "You need Manage Server permission to configure smart VC.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return;
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("smartvc_action_select")
            .setPlaceholder("Select an action")
            .addOptions([
                {
                    label: "Enable Smart VC",
                    description: "Set a voice channel with camera/mic requirements",
                    value: "set"
                },
                {
                    label: "Check Current Settings",
                    description: "View active smart VC configuration",
                    value: "status"
                },
                {
                    label: "Disable Smart VC",
                    description: "Turn off smart VC enforcement",
                    value: "disable"
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
            content: "Smart VC Enforcement System\nSelect an action below:",
            components: [row],
            flags: 64
        });
        
        interaction.client.smartvcContext = {
            interaction
        };
        
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) {}
            delete interaction.client.smartvcContext;
        }, 30000);
    }
};