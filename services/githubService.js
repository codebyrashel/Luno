const { spawn } = require("child_process");

class GitHubService {
    async getUserEvents(username) {
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
            const today = new Date().toISOString().split('T')[0];
            
            let commitCount = 0;
            for (const event of events) {
                const eventDate = new Date(event.created_at).toISOString().split('T')[0];
                if (eventDate === today && event.type === "PushEvent") {
                    commitCount += event.payload.commits?.length || 0;
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
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            let commitCount = 0;
            for (const event of events) {
                const eventDate = new Date(event.created_at);
                if (eventDate >= weekAgo && event.type === "PushEvent") {
                    commitCount += event.payload.commits?.length || 0;
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
            
            const dates = [...new Set(pushEvents.map(event => 
                new Date(event.created_at).toISOString().split('T')[0]
            ))];
            
            dates.sort().reverse();
            
            let streak = 1;
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            if (!dates.includes(today) && !dates.includes(yesterday)) {
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