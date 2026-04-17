const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const { createMusicEmbed, createControlButtons, createSongSelectMenu } = require("../utils/musicHelpers");

module.exports = async (interaction, musicService) => {
    if (!interaction.isButton()) return false;
    
    const session = musicService.getSession(interaction.guild.id);
    
    if (!session) {
        const msg = await interaction.reply({ content: "No music session active!", flags: 64 });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 3000);
        return true;
    }
    
    // Handle loop buttons
    if (interaction.customId === "music_loop_off") {
        if (session.loop === "off") {
            const msg = await interaction.reply({ content: "Loop is already disabled!", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        musicService.setLoop(interaction.guild, "off");
        const msg = await interaction.reply({ content: "Loop disabled", flags: 64 });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 3000);
        
        const updatedSession = musicService.getSession(interaction.guild.id);
        if (updatedSession && updatedSession.current) {
            const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
            const rows = createControlButtons(updatedSession);
            if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
            }
        }
        return true;
    }
    
    if (interaction.customId === "music_loop_song") {
        if (session.loop === "song") {
            const msg = await interaction.reply({ content: "Song loop is already enabled!", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        musicService.setLoop(interaction.guild, "song");
        const msg = await interaction.reply({ content: "Loop mode: Single Song", flags: 64 });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 3000);
        
        const updatedSession = musicService.getSession(interaction.guild.id);
        if (updatedSession && updatedSession.current) {
            const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
            const rows = createControlButtons(updatedSession);
            if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
            }
        }
        return true;
    }
    
    if (interaction.customId === "music_loop_queue") {
        if (session.loop === "queue") {
            const msg = await interaction.reply({ content: "Queue loop is already enabled!", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        if (session.queue.length === 0 && !session.current) {
            const msg = await interaction.reply({ content: "Cannot enable queue loop. Queue is empty!", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        musicService.setLoop(interaction.guild, "queue");
        const msg = await interaction.reply({ content: "Loop mode: Entire Queue", flags: 64 });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 3000);
        
        const updatedSession = musicService.getSession(interaction.guild.id);
        if (updatedSession && updatedSession.current) {
            const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
            const rows = createControlButtons(updatedSession);
            if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
            }
        }
        return true;
    }
    
    switch (interaction.customId) {
        case "music_previous":
            if (!session.history || session.history.length <= 1) {
                const msg = await interaction.reply({ 
                    content: "No previous song in history! Add more songs to the queue.",
                    flags: 64
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
                return true;
            }
            
            if (session.player && session.player.state.status === "paused") {
                musicService.togglePause(interaction.guild);
            }
            
            const prevSuccess = musicService.prev(interaction.guild);
            if (!prevSuccess) {
                const msg = await interaction.reply({ 
                    content: "Cannot go to previous song. No songs in history.",
                    flags: 64
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            } else {
                const msg = await interaction.reply({ content: "Playing previous song!", flags: 64 });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            }
            
            setTimeout(async () => {
                const updatedSession = musicService.getSession(interaction.guild.id);
                if (updatedSession && updatedSession.current) {
                    const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
                    const rows = createControlButtons(updatedSession);
                    if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                        await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
                    }
                }
            }, 100);
            break;
            
        case "music_play_pause":
            if (!session.player) {
                const msg = await interaction.reply({ content: "No audio player active!", flags: 64 });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
                return true;
            }
            
            const currentState = session.player.state.status;
            
            if (currentState === "playing") {
                musicService.togglePause(interaction.guild);
                const msg = await interaction.reply({ content: "Paused", flags: 64 });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            } else if (currentState === "paused") {
                musicService.togglePause(interaction.guild);
                const msg = await interaction.reply({ content: "Resumed", flags: 64 });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            }
            
            setTimeout(async () => {
                const updatedSession = musicService.getSession(interaction.guild.id);
                if (updatedSession && updatedSession.current) {
                    const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
                    const rows = createControlButtons(updatedSession);
                    if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                        await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
                    }
                }
            }, 100);
            break;
            
        case "music_queue":
            if (!session.queue || session.queue.length === 0) {
                const msg = await interaction.reply({ 
                    content: "Queue is empty! Add some songs first.",
                    flags: 64
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
                return true;
            }
            
            const options = createSongSelectMenu(session, 0);
            const selectRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("queue_select")
                        .setPlaceholder("Select a song to play")
                        .addOptions(options.slice(0, 25))
                );
            
            // Send as normal message (not ephemeral)
            const queueMsg = await interaction.reply({
                content: "**Select a song to play:**",
                components: [selectRow]
            });
            
            // Auto-delete the queue menu after 30 seconds if not used
            setTimeout(async () => {
                try {
                    await queueMsg.delete();
                } catch (e) {}
            }, 30000);
            break;
            
        case "music_stop":
            if (session.idleTimer) {
                clearTimeout(session.idleTimer);
            }
            
            if (session.player) {
                session.player.stop();
            }
            
            session.queue = [];
            session.history = [];
            session.current = null;
            session.playing = false;
            session.loop = "off";
            
            const conn = getVoiceConnection(interaction.guild.id);
            if (conn) {
                conn.destroy();
            }
            
            musicService.sessions.delete(interaction.guild.id);
            
            const stopMsg = await interaction.reply({ content: "Stopped music and disconnected from voice channel.", flags: 64 });
            setTimeout(async () => {
                try {
                    await stopMsg.delete();
                } catch (e) {}
            }, 3000);
            break;
            
        case "music_next":
            if (!session.queue || session.queue.length === 0) {
                const msg = await interaction.reply({ 
                    content: "No next song in queue! Add more songs to continue playing.",
                    flags: 64
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
                return true;
            }
            
            if (session.player && session.player.state.status === "paused") {
                musicService.togglePause(interaction.guild);
            }
            
            const skipSuccess = musicService.skip(interaction.guild);
            if (!skipSuccess) {
                const msg = await interaction.reply({ 
                    content: "Cannot skip to next song. Queue is empty.",
                    flags: 64
                });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            } else {
                const msg = await interaction.reply({ content: "Skipped to next song!", flags: 64 });
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch (e) {}
                }, 3000);
            }
            
            setTimeout(async () => {
                const updatedSession = musicService.getSession(interaction.guild.id);
                if (updatedSession && updatedSession.current) {
                    const updatedEmbed = createMusicEmbed(updatedSession, updatedSession.current, "Now Playing");
                    const rows = createControlButtons(updatedSession);
                    if (updatedSession.lastMessage && updatedSession.lastMessage.editable) {
                        await updatedSession.lastMessage.edit({ embeds: [updatedEmbed], components: rows });
                    }
                }
            }, 100);
            break;
    }
    
    return true;
};