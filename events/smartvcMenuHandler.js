const { ChannelType, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const smartVCService = require("../services/smartVCService");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "smartvc_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.smartvcContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /smartvc again.",
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
        
        switch (action) {
            case "set":
                // Ask for voice channel
                const channelMsg = await interaction.reply({
                    content: "Please mention the voice channel you want to enforce:",
                    flags: 64
                });
                
                const channelFilter = (m) => m.author.id === interaction.user.id && m.mentions.channels.size > 0;
                const channelCollector = interaction.channel.createMessageCollector({ filter: channelFilter, time: 30000, max: 1 });
                
                channelCollector.on("collect", async (message) => {
                    const voiceChannel = message.mentions.channels.first();
                    
                    if (voiceChannel.type !== ChannelType.GuildVoice) {
                        const errorMsg = await interaction.followUp({ 
                            content: "Please select a voice channel!",
                            flags: 64 
                        });
                        setTimeout(async () => {
                            try {
                                await errorMsg.delete();
                            } catch (e) {}
                        }, 3000);
                        return;
                    }
                    
                    // Ask for mic requirement
                    const micMenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("smartvc_mic_select")
                                .setPlaceholder("Select microphone requirement")
                                .addOptions([
                                    { label: "Microphone Required", value: "true", description: "Users must have mic active" },
                                    { label: "Microphone Optional", value: "false", description: "Only camera is required" }
                                ])
                        );
                    
                    const micMsg = await interaction.followUp({
                        content: `Selected channel: ${voiceChannel.name}\nDo you want to require microphone activity?`,
                        components: [micMenu],
                        flags: 64
                    });
                    
                    interaction.client.smartvcChannelContext = {
                        voiceChannel,
                        micMsg
                    };
                    
                    try {
                        await message.delete();
                    } catch (e) {}
                    try {
                        await channelMsg.delete();
                    } catch (e) {}
                });
                
                channelCollector.on("end", async (collected) => {
                    if (collected.size === 0) {
                        const timeoutMsg = await interaction.followUp({ 
                            content: "Channel selection timed out. Please use /smartvc again.",
                            flags: 64 
                        });
                        setTimeout(async () => {
                            try {
                                await timeoutMsg.delete();
                            } catch (e) {}
                        }, 3000);
                    }
                });
                break;
                
            case "status":
                const config = smartVCService.getStatus(interaction.guild.id);
                
                if (!config || !config.enabled) {
                    const statusMsg = await interaction.reply({ 
                        content: "Smart VC enforcement is not configured for this server.\nUse 'Enable Smart VC' to get started.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await statusMsg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const channel = interaction.guild.channels.cache.get(config.channelId);
                const channelName = channel ? channel.name : "Unknown channel";
                const micRequirement = config.requireMic ? "Required" : "Optional";
                
                const statusText = `Smart VC Configuration\n\n` +
                    `Status: Enabled\n` +
                    `Channel: ${channelName}\n` +
                    `Camera: Required (within 30 seconds)\n` +
                    `Microphone: ${micRequirement}\n\n` +
                    `Users without camera (and mic if required) will be automatically disconnected.`;
                
                const statusMsg = await interaction.reply({ 
                    content: statusText,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statusMsg.delete();
                    } catch (e) {}
                }, 15000);
                break;
                
            case "disable":
                const currentConfig = smartVCService.getStatus(interaction.guild.id);
                
                if (!currentConfig || !currentConfig.enabled) {
                    const alreadyMsg = await interaction.reply({ 
                        content: "Smart VC enforcement is already disabled.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await alreadyMsg.delete();
                        } catch (e) {}
                    }, 3000);
                    return true;
                }
                
                smartVCService.disable(interaction.guild.id);
                
                const disableMsg = await interaction.reply({ 
                    content: "Smart VC enforcement has been disabled.\nNo voice channels are being monitored.",
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await disableMsg.delete();
                    } catch (e) {}
                }, 5000);
                break;
        }
        
        delete interaction.client.smartvcContext;
        return true;
    }
    
    if (interaction.customId === "smartvc_mic_select") {
        const requireMic = interaction.values[0] === "true";
        const context = interaction.client.smartvcChannelContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /smartvc again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const voiceChannel = context.voiceChannel;
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        if (context.micMsg) {
            try {
                await context.micMsg.delete();
            } catch (e) {}
        }
        
        const config = smartVCService.setChannel(interaction.guild.id, voiceChannel.id, requireMic);
        
        const micText = requireMic ? "required" : "optional";
        const successMsg = await interaction.reply({ 
            content: `Smart VC enforcement enabled for ${voiceChannel.name}\n\n` +
                `Camera required within 30 seconds after joining\n` +
                `Microphone ${micText}\n` +
                `Users not meeting requirements will be removed automatically.`,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await successMsg.delete();
            } catch (e) {}
        }, 10000);
        
        delete interaction.client.smartvcChannelContext;
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    return await handleSelectMenu(interaction);
};