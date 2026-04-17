const { createAudioResource } = require("@discordjs/voice");
const { createMusicEmbed, createControlButtons } = require("../utils/musicHelpers");

module.exports = async (interaction, musicService) => {
    if (!interaction.isStringSelectMenu()) return false;

    if (interaction.customId === "queue_select") {
        const selectedValue = interaction.values[0];
        const session = musicService.getSession(interaction.guild.id);

        if (!session) {
            const msg = await interaction.reply({ content: "No music session active!", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) { }
            }, 3000);
            return true;
        }

        // Delete the original queue selection message
        try {
            await interaction.message.delete();
        } catch (e) { }

        // Handle "current" selection (show info)
        if (selectedValue === "current") {
            const msg = await interaction.reply({
                content: `🎵 Currently playing: ${session.current?.title || "Nothing playing"}`,
                flags: 64
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) { }
            }, 3000);
            return true;
        }

        // Resume if paused
        if (session.player && session.player.state.status === "paused") {
            musicService.togglePause(interaction.guild);
        }

        const songIndex = parseInt(selectedValue.split("_")[1]);
        const selectedSong = session.queue[songIndex];

        if (selectedSong) {
            session.queue.splice(songIndex, 1);
            if (session.current) {
                session.queue.unshift(session.current);
            }
            session.queue.unshift(selectedSong);
            musicService.skip(interaction.guild);

            const msg = await interaction.reply({ content: `▶️ Now playing: ${selectedSong.title}`, flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) { }
            }, 3000);

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
        } else {
            const msg = await interaction.reply({ content: "Failed to play selected song.", flags: 64 });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) { }
            }, 3000);
        }

        return true;
    }

    return false;
};