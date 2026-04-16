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

        if (!session.player || !session.playing) return false;

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

        if (session.idleTimer) {
            clearTimeout(session.idleTimer);
        }

        session.idleTimer = setTimeout(() => {
            const voiceChannel = session.connection?.joinConfig?.channelId;
            if (voiceChannel) {
                const channel = guild.channels.cache.get(voiceChannel);
                if (channel && channel.members.size <= 1) {
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