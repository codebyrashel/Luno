const { spawn } = require("child_process");

class GitHubService {
    constructor() {
        // Bangladesh timezone offset (UTC+6)
        this.timezoneOffset = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    }

    getBangladeshDate(timestamp = Date.now()) {
        const bangladeshTime = new Date(timestamp + this.timezoneOffset);
        return bangladeshTime.toISOString().split('T')[0];
    }

    getUserEvents(username) {
        return new Promise((resolve, reject) => {
            const curl = spawn("curl", [
                "-s",
                "--connect-timeout", "10",
                "--max-time", "15",
                `https://api.github.com/users/${username}/events`
            ]);

            let output = "";
            let errorOutput = "";
            
            curl.stdout.on("data", (data) => {
                output += data.toString();
            });
            
            curl.stderr.on("data", (data) => {
                errorOutput += data.toString();
            });

            curl.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to fetch GitHub events`));
                    return;
                }

                try {
                    const events = JSON.parse(output);
                    if (events.message === "Not Found") {
                        reject(new Error(`User ${username} not found on GitHub`));
                        return;
                    }
                    if (events.message === "API rate limit exceeded") {
                        reject(new Error(`GitHub API rate limit exceeded. Try again later.`));
                        return;
                    }
                    resolve(events);
                } catch (e) {
                    reject(new Error(`Failed to parse GitHub response`));
                }
            });

            curl.on("error", (err) => {
                reject(new Error(`Network error: ${err.message}`));
            });
        });
    }

    async getTodayCommits(username) {
        try {
            const events = await this.getUserEvents(username);
            const todayBD = this.getBangladeshDate();
            
            let commitCount = 0;
            for (const event of events) {
                if (event.type === "PushEvent") {
                    // Convert event time to Bangladesh timezone
                    const eventDate = this.getBangladeshDate(new Date(event.created_at).getTime());
                    if (eventDate === todayBD) {
                        commitCount += event.payload.commits?.length || 0;
                    }
                }
            }
            return commitCount;
        } catch (error) {
            console.error(`Error fetching commits for ${username}:`, error.message);
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const events = await this.getUserEvents(username);
            const nowBD = new Date(Date.now() + this.timezoneOffset);
            const weekAgoBD = new Date(nowBD.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            let commitCount = 0;
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventDate = new Date(new Date(event.created_at).getTime() + this.timezoneOffset);
                    if (eventDate >= weekAgoBD) {
                        commitCount += event.payload.commits?.length || 0;
                    }
                }
            }
            return commitCount;
        } catch (error) {
            console.error(`Error fetching weekly commits for ${username}:`, error.message);
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            const events = await this.getUserEvents(username);
            const pushEvents = events.filter(event => event.type === "PushEvent");
            
            if (pushEvents.length === 0) return 0;
            
            // Convert all event dates to Bangladesh timezone
            const dates = [...new Set(pushEvents.map(event => 
                this.getBangladeshDate(new Date(event.created_at).getTime())
            ))];
            
            dates.sort().reverse();
            
            let streak = 1;
            const todayBD = this.getBangladeshDate();
            const yesterdayBD = this.getBangladeshDate(Date.now() - 86400000);
            
            if (!dates.includes(todayBD) && !dates.includes(yesterdayBD)) {
                return 0;
            }
            
            for (let i = 0; i < dates.length - 1; i++) {
                const current = new Date(dates[i]);
                const next = new Date(dates[i + 1]);
                const diffDays = Math.floor((current - next) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    streak++;
                } else {
                    break;
                }
            }
            return streak;
        } catch (error) {
            console.error(`Error fetching streak for ${username}:`, error.message);
            return 0;
        }
    }
}

module.exports = new GitHubService();