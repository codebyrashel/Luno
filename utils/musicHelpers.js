const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function createMusicEmbed(session, currentSong, title, isAddition = false) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(title)
        .setDescription(`**${currentSong?.title || "Nothing playing"}**`)
        .addFields(
            { name: "Requested by", value: currentSong?.requester?.username || "Unknown", inline: true },
            { name: "Duration", value: currentSong?.duration ? formatTime(currentSong.duration) : "Live", inline: true },
            { name: "Loop Mode", value: session.loop === "off" ? "Disabled" : session.loop === "song" ? "Single Song" : "Queue", inline: true },
            { name: "Queue Length", value: `${session.queue.length} songs`, inline: true }
        )
        .setFooter({ text: isAddition ? "Added to queue" : "Music Player Controls" })
        .setTimestamp();

    if (currentSong?.thumbnail) {
        embed.setThumbnail(currentSong.thumbnail);
    }

    return embed;
}

function createControlButtons(session) {
    const hasQueue = session.queue && session.queue.length > 0;
    const hasHistory = session.history && session.history.length > 1;
    const isPlaying = session.player && session.player.state.status === "playing";
    
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("music_previous")
                .setLabel("Prev")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasHistory),
            new ButtonBuilder()
                .setCustomId("music_play_pause")
                .setLabel(isPlaying ? "Pause" : "Play")
                .setStyle(isPlaying ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("music_next")
                .setLabel("Next")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasQueue),
            new ButtonBuilder()
                .setCustomId("music_queue")
                .setLabel("Queue")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("music_stop")
                .setLabel("Stop")
                .setStyle(ButtonStyle.Danger)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("music_loop_off")
                .setLabel("Loop Off")
                .setStyle(session.loop === "off" ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("music_loop_song")
                .setLabel("Loop Song")
                .setStyle(session.loop === "song" ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("music_loop_queue")
                .setLabel("Loop Queue")
                .setStyle(session.loop === "queue" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
    
    return [row1, row2];
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "Live";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function createSongSelectMenu(session, page = 0) {
    const itemsPerPage = 25;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentPageSongs = session.queue.slice(start, end);
    
    const options = [];
    
    // Add currently playing with checkmark
    if (session.current) {
        options.push({
            label: `✅ ${session.current.title.substring(0, 75)}`,
            description: `Duration: ${formatTime(session.current.duration)} | Now Playing`,
            value: "current",
            default: false
        });
    }
    
    currentPageSongs.forEach((song, index) => {
        const position = start + index + 1;
        options.push({
            label: `${position}. ${song.title.substring(0, 75)}`,
            description: `Duration: ${formatTime(song.duration)} | By: ${song.requester?.username || "Unknown"}`,
            value: `song_${position - 1}`
        });
    });
    
    return options;
}

module.exports = { createMusicEmbed, createControlButtons, formatTime, createSongSelectMenu };