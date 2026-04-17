const {
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    joinVoiceChannel,
    getVoiceConnection,
    AudioPlayerStatus,
} = require("@discordjs/voice");
const { spawn } = require("child_process");

class MusicService {
    constructor() {
        this.sessions = new Map();
    }

    getSession(guildId) {
        if (!this.sessions.has(guildId)) {
            this.sessions.set(guildId, {
                queue: [],
                history: [],
                playing: false,
                loop: "off",
                player: null,
                connection: null,
                current: null,
                currentInfo: null,
                idleTimer: null,
                volume: 1,
                lastMessage: null,
            });
        }
        return this.sessions.get(guildId);
    }

    join(guild, channel) {
        let connection = getVoiceConnection(guild.id);

        if (!connection) {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        return connection;
    }

    isSongInQueue(session, url, title) {
        if (session.current && (session.current.url === url || session.current.title === title)) {
            return { inQueue: true, position: "currently playing" };
        }
        
        const queueIndex = session.queue.findIndex(song => song.url === url || song.title === title);
        if (queueIndex !== -1) {
            return { inQueue: true, position: `position ${queueIndex + 1} in queue` };
        }
        
        return { inQueue: false };
    }

    async addSong(guild, channel, url, requester) {
        const session = this.getSession(guild.id);

        session.connection = this.join(guild, channel);

        try {
            const videoInfo = await this.getVideoInfo(url);
            const songInfo = {
                url: url,
                title: videoInfo.title,
                duration: videoInfo.duration,
                thumbnail: videoInfo.thumbnails?.high?.url || videoInfo.thumbnail,
                requester: requester
            };

            const duplicateCheck = this.isSongInQueue(session, url, songInfo.title);
            if (duplicateCheck.inQueue) {
                const error = new Error(`Song "${songInfo.title}" is already ${duplicateCheck.position}!`);
                error.isDuplicate = true;
                throw error;
            }

            session.queue.push(songInfo);

            if (!session.player) {
                this.createPlayer(guild);
            }

            if (!session.playing) {
                this.playNext(guild);
            }

            return songInfo;
        } catch (error) {
            console.error("Error adding song:", error);
            throw error;
        }
    }

    async addPlaylist(guild, channel, playlistUrl, requester) {
        const session = this.getSession(guild.id);
        session.connection = this.join(guild, channel);
        
        try {
            const playlistInfo = await this.getPlaylistInfo(playlistUrl);
            const songs = playlistInfo.entries;
            
            let addedCount = 0;
            let duplicateCount = 0;
            const duplicateSongs = [];
            
            for (const song of songs) {
                // Get full video info for thumbnail
                let fullSongInfo;
                try {
                    fullSongInfo = await this.getVideoInfo(song.url);
                } catch (e) {
                    fullSongInfo = song;
                }
                
                const songInfo = {
                    url: song.url,
                    title: fullSongInfo.title || song.title,
                    duration: fullSongInfo.duration || song.duration,
                    thumbnail: fullSongInfo.thumbnails?.high?.url || fullSongInfo.thumbnail || song.thumbnail,
                    requester: requester
                };
                
                const duplicateCheck = this.isSongInQueue(session, song.url, songInfo.title);
                if (duplicateCheck.inQueue) {
                    duplicateCount++;
                    duplicateSongs.push(songInfo.title);
                    continue;
                }
                
                session.queue.push(songInfo);
                addedCount++;
            }
            
            if (!session.player) {
                this.createPlayer(guild);
            }
            
            if (!session.playing) {
                this.playNext(guild);
            }
            
            const result = { addedCount, duplicateCount, duplicateSongs };
            if (duplicateCount > 0) {
                result.message = `Added ${addedCount} songs. Skipped ${duplicateCount} duplicate(s): ${duplicateSongs.slice(0, 3).join(", ")}${duplicateSongs.length > 3 ? ` and ${duplicateSongs.length - 3} more` : ""}`;
            }
            
            return result;
        } catch (error) {
            console.error("Error adding playlist:", error);
            throw error;
        }
    }

    async getPlaylistInfo(url) {
        return new Promise((resolve, reject) => {
            const yt = spawn("yt-dlp", [
                "-j",
                "--flat-playlist",
                url,
            ]);
            
            let output = "";
            const entries = [];
            
            yt.stdout.on("data", (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const info = JSON.parse(line);
                            entries.push({
                                url: info.url || info.webpage_url,
                                title: info.title,
                                duration: info.duration,
                                thumbnail: info.thumbnail
                            });
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            });
            
            yt.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error("Failed to get playlist info"));
                    return;
                }
                resolve({ entries });
            });
            
            yt.on("error", reject);
        });
    }

    async getVideoInfo(url) {
        return new Promise((resolve, reject) => {
            const yt = spawn("yt-dlp", [
                "-j",
                url,
            ]);

            let output = "";
            yt.stdout.on("data", (data) => {
                output += data.toString();
            });

            yt.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error("Failed to get video info"));
                    return;
                }

                try {
                    const info = JSON.parse(output);
                    resolve({
                        title: info.title,
                        duration: info.duration,
                        thumbnail: info.thumbnail,
                        channel: info.channel,
                        uploadDate: info.upload_date,
                        viewCount: info.view_count,
                        thumbnails: info.thumbnails
                    });
                } catch (e) {
                    reject(e);
                }
            });

            yt.on("error", reject);
        });
    }

    createPlayer(guild) {
        const session = this.getSession(guild.id);

        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        });

        player.on(AudioPlayerStatus.Idle, () => {
            this.handleSongEnd(guild);
        });

        player.on(AudioPlayerStatus.Playing, () => {
            session.playing = true;
        });

        player.on(AudioPlayerStatus.Paused, () => {
            session.playing = true;
        });

        player.on("error", (error) => {
            console.error("Player error:", error);
            this.handleSongEnd(guild);
        });

        session.connection.subscribe(player);
        session.player = player;
    }

    getStream(url) {
        const yt = spawn("yt-dlp", [
            "-f",
            "bestaudio",
            "-o",
            "-",
            "--no-playlist",
            url,
        ]);

        return yt.stdout;
    }

    playNext(guild) {
        const session = this.getSession(guild.id);

        if (session.queue.length === 0 && session.loop !== "song") {
            session.playing = false;
            session.current = null;
            session.currentInfo = null;
            this.startIdleDisconnect(guild);
            return;
        }

        if (session.loop === "song" && session.current) {
            session.queue.unshift(session.current);
        }

        const song = session.queue.shift();

        if (!song) {
            session.playing = false;
            session.current = null;
            session.currentInfo = null;
            this.startIdleDisconnect(guild);
            return;
        }

        session.current = song;
        session.history.push(song);
        session.playing = true;

        const stream = this.getStream(song.url);
        const resource = createAudioResource(stream);

        session.player.play(resource);
    }

    handleSongEnd(guild) {
        const session = this.getSession(guild.id);

        if (session.loop === "queue" && session.current) {
            session.queue.push(session.current);
        }

        this.playNext(guild);
    }

    skip(guild) {
        const session = this.getSession(guild.id);

        if (!session.current) return false;

        session.player.stop();
        return true;
    }

    stop(guild) {
        const session = this.getSession(guild.id);

        if (session.idleTimer) {
            clearTimeout(session.idleTimer);
        }

        session.queue = [];
        session.history = [];
        session.playing = false;
        session.current = null;
        session.currentInfo = null;
        session.loop = "off";

        if (session.player) {
            session.player.stop();
        }

        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();

        this.sessions.delete(guild.id);
    }

    prev(guild) {
        const session = this.getSession(guild.id);

        if (!session.history || session.history.length <= 1) {
            return false;
        }

        session.history.pop();

        const prevSong = session.history.pop();

        if (!prevSong) {
            return false;
        }

        if (session.current) {
            session.queue.unshift(session.current);
        }

        session.queue.unshift(prevSong);
        
        session.player.stop();
        
        return true;
    }

    togglePause(guild) {
        const session = this.getSession(guild.id);

        if (!session.player) return false;

        const state = session.player.state.status;

        if (state === "playing") {
            session.player.pause();
            return "paused";
        } else if (state === "paused") {
            session.player.unpause();
            return "playing";
        }
        
        return false;
    }

    setLoop(guild, mode) {
        const session = this.getSession(guild.id);

        if (mode === "queue") {
            if (session.queue.length === 0 && session.current) {
                session.loop = "song";
                return "song";
            } else if (session.queue.length === 0 && !session.current) {
                return false;
            }
            session.loop = "queue";
            return "queue";
        } else if (mode === "song") {
            session.loop = "song";
            return "song";
        } else {
            session.loop = "off";
            return "off";
        }
    }

    startIdleDisconnect(guild) {
        const session = this.getSession(guild.id);
        const textChannel = session.lastMessage?.channel;

        if (session.idleTimer) {
            clearTimeout(session.idleTimer);
        }

        session.idleTimer = setTimeout(async () => {
            const voiceChannel = session.connection?.joinConfig?.channelId;
            if (voiceChannel) {
                const channel = guild.channels.cache.get(voiceChannel);
                if (channel && channel.members.size <= 1) {
                    if (textChannel) {
                        try {
                            await textChannel.send("No music has been played for 1 minute. Disconnecting from voice channel.");
                        } catch (e) {
                            console.log("Could not send disconnect message");
                        }
                    }
                    
                    const conn = getVoiceConnection(guild.id);
                    if (conn) conn.destroy();
                    this.sessions.delete(guild.id);
                }
            }
        }, 60 * 1000);
    }

    getQueue(guild) {
        const session = this.getSession(guild.id);
        return {
            current: session.current,
            queue: session.queue,
            loop: session.loop,
            playing: session.playing
        };
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "Live";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = new MusicService();