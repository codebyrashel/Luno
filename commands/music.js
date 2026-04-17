const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play YouTube audio")
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Playback type")
                .setRequired(true)
                .addChoices(
                    { name: "Single Song", value: "single" },
                    { name: "Playlist", value: "playlist" }
                )
        )
        .addStringOption(opt =>
            opt.setName("url")
                .setDescription("YouTube URL")
                .setRequired(true)
        ),
    execute: async (interaction, musicService) => {
        const type = interaction.options.getString("type");
        const url = interaction.options.getString("url");
        
        // Check if single song but URL is a playlist
        if (type === "single" && (url.includes("playlist") || url.includes("&list="))) {
            const msg = await interaction.reply({ 
                content: "❌ This appears to be a playlist URL. Please use `type: Playlist` to add multiple songs, or use a single video URL for single song mode.",
                flags: 64
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 5000);
            return;
        }
        
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const msg = await interaction.reply({
                content: "You need to be in a voice channel to play music!",
                flags: 64
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return;
        }
        
        await interaction.deferReply();
        
        try {
            const session = musicService.getSession(interaction.guild.id);
            const wasPlaying = session.playing;
            
            if (type === "single") {
                const songInfo = await musicService.addSong(interaction.guild, voiceChannel, url, interaction.user);
                
                if (wasPlaying) {
                    const { createMusicEmbed } = require("../utils/musicHelpers");
                    const embed = createMusicEmbed(session, songInfo, "Added to Queue", true);
                    const msg = await interaction.editReply({ embeds: [embed] });
                    
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 3000);
                    
                    if (session.lastMessage && session.lastMessage.editable) {
                        const { createControlButtons } = require("../utils/musicHelpers");
                        const currentEmbed = createMusicEmbed(session, session.current, "Now Playing");
                        const rows = createControlButtons(session);
                        await session.lastMessage.edit({ embeds: [currentEmbed], components: rows });
                    }
                } else {
                    const { createMusicEmbed, createControlButtons } = require("../utils/musicHelpers");
                    const embed = createMusicEmbed(session, songInfo, "Now Playing");
                    const rows = createControlButtons(session);
                    
                    if (session.lastMessage && session.lastMessage.editable) {
                        await session.lastMessage.edit({ embeds: [embed], components: rows });
                        const msg = await interaction.editReply("Now playing!");
                        setTimeout(async () => {
                            try {
                                await msg.delete();
                            } catch (e) {}
                        }, 3000);
                    } else {
                        const msg = await interaction.editReply({ embeds: [embed], components: rows });
                        session.lastMessage = msg;
                    }
                }
            } 
            else if (type === "playlist") {
                const result = await musicService.addPlaylist(interaction.guild, voiceChannel, url, interaction.user);
                
                if (wasPlaying) {
                    let replyMessage = `Added ${result.addedCount} songs to the queue!`;
                    if (result.duplicateCount > 0) {
                        replyMessage += `\n${result.message}`;
                    }
                    
                    const msg = await interaction.editReply(replyMessage);
                    
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    
                    if (session.lastMessage && session.lastMessage.editable) {
                        const { createMusicEmbed, createControlButtons } = require("../utils/musicHelpers");
                        const currentEmbed = createMusicEmbed(session, session.current, "Now Playing");
                        const rows = createControlButtons(session);
                        await session.lastMessage.edit({ embeds: [currentEmbed], components: rows });
                    }
                } else {
                    const { createMusicEmbed, createControlButtons } = require("../utils/musicHelpers");
                    const embed = createMusicEmbed(session, session.current || { title: "Playlist added" }, "Now Playing");
                    const rows = createControlButtons(session);
                    
                    let replyMessage = `Added ${result.addedCount} songs to the queue!`;
                    if (result.duplicateCount > 0) {
                        replyMessage += `\n${result.message}`;
                    }
                    
                    if (session.lastMessage && session.lastMessage.editable) {
                        await session.lastMessage.edit({ embeds: [embed], components: rows });
                        const msg = await interaction.editReply(replyMessage);
                        setTimeout(async () => {
                            try {
                                await msg.delete();
                            } catch (e) {}
                        }, 5000);
                    } else {
                        const msg = await interaction.editReply({ embeds: [embed], components: rows });
                        session.lastMessage = msg;
                        const followupMsg = await interaction.followUp({ content: replyMessage, flags: 64 });
                        setTimeout(async () => {
                            try {
                                await followupMsg.delete();
                            } catch (e) {}
                        }, 5000);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            const errorMsg = await interaction.editReply(err.message || "Failed to play. Please check the URL and try again.");
            setTimeout(async () => {
                try {
                    await errorMsg.delete();
                } catch (e) {}
            }, 5000);
        }
    }
};