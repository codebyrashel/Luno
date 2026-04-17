const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const focusService = require("../services/focusService");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "focus_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.focusContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /focus again.",
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
        const member = context.member;
        const voiceChannel = context.voiceChannel;
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        switch (action) {
            case "start":
                if (!voiceChannel) {
                    const msg = await interaction.reply({ 
                        content: "Join a voice channel first.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                if (focusService.isInSession(userId)) {
                    const msg = await interaction.reply({ 
                        content: "You already have an active focus session.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                const modal = new ModalBuilder()
                    .setCustomId("focus_duration_modal")
                    .setTitle("Start Focus Session");
                
                const durationInput = new TextInputBuilder()
                    .setCustomId("duration_minutes")
                    .setLabel("Focus duration (minutes)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Enter number of minutes (e.g., 25, 30, 45, 60)")
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(4);
                
                const actionRow = new ActionRowBuilder().addComponents(durationInput);
                modal.addComponents(actionRow);
                
                await interaction.showModal(modal);
                
                interaction.client.focusModalContext = {
                    userId,
                    member,
                    voiceChannel
                };
                break;
                
            case "stop":
                if (!focusService.isInSession(userId)) {
                    const msg = await interaction.reply({ 
                        content: "No active focus session.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                focusService.endSession(userId);
                
                try {
                    await member.voice.setMute(false);
                } catch (err) {
                    console.log("Unmute failed");
                }
                
                const stopMsg = await interaction.reply({ 
                    content: "Focus session stopped.",
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await stopMsg.delete();
                    } catch (e) {}
                }, 3000);
                break;
                
            case "status":
                const session = focusService.getSession(userId);
                
                if (!session) {
                    const msg = await interaction.reply({ 
                        content: "No active focus session.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                const remainingMs = session.endTime - Date.now();
                const minutes = Math.max(0, Math.floor(remainingMs / 60000));
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                
                const statusMsg = await interaction.reply({ 
                    content: `Focus Session Status\nRemaining time: ${minutes}m ${seconds}s`,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statusMsg.delete();
                    } catch (e) {}
                }, 5000);
                break;
                
            case "stats":
                const stats = focusService.getUserStats(userId);
                const last24 = focusService.formatTime(stats.last24);
                const last7 = focusService.formatTime(stats.last7);
                const total = focusService.formatTime(stats.total);
                
                const statsMsg = await interaction.reply({ 
                    content: `Your Focus Stats\n\nLast 24h: ${last24}\nLast 7 days: ${last7}\nTotal: ${total}`,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statsMsg.delete();
                    } catch (e) {}
                }, 10000);
                break;
        }
        
        delete interaction.client.focusContext;
        
        return true;
    }
    
    return false;
}

async function handleModal(interaction) {
    if (!interaction.isModalSubmit()) return false;
    
    if (interaction.customId === "focus_duration_modal") {
        const durationMinutes = parseInt(interaction.fields.getTextInputValue("duration_minutes"));
        const context = interaction.client.focusModalContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /focus again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        if (isNaN(durationMinutes) || durationMinutes < 1) {
            const msg = await interaction.reply({ 
                content: "Please enter a valid number of minutes (minimum 1 minute).",
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
        const member = context.member;
        const voiceChannel = context.voiceChannel;
        
        const endTime = focusService.startSession(userId, durationMinutes, voiceChannel.id);
        
        try {
            await member.voice.setMute(true);
        } catch (err) {
            console.log("Mute failed");
        }
        
        const endDate = new Date(endTime);
        const msg = await interaction.reply({ 
            content: `Focus session started!\nDuration: ${durationMinutes} minutes\nEnds at: ${endDate.toLocaleTimeString()}\nYou have been muted. Stay focused!`,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 8000);
        
        delete interaction.client.focusModalContext;
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