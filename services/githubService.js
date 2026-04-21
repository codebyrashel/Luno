const { spawn } = require("child_process");

class GitHubService {
    constructor() {
        // Bangladesh timezone offset (UTC+6)
        this.timezoneOffset = 6 * 60 * 60 * 1000;
    }

    getBangladeshDate(timestamp = Date.now()) {
        const bangladeshTime = new Date(timestamp + this.timezoneOffset);
        const year = bangladeshTime.getUTCFullYear();
        const month = String(bangladeshTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bangladeshTime.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
                    console.error(`GitHub API curl error code ${code}: ${errorOutput}`);
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
                    console.log(`[DEBUG] Fetched ${events.length} events for ${username}`);
                    resolve(events);
                } catch (e) {
                    console.error(`[DEBUG] Failed to parse JSON: ${output.substring(0, 200)}`);
                    reject(new Error(`Failed to parse GitHub response`));
                }
            });

            curl.on("error", (err) => {
                reject(new Error(`Network error: ${err.message}`));
            });
        });
    }

    async getCommitsBetween(repo, before, head) {
        return new Promise((resolve, reject) => {
            const curl = spawn("curl", [
                "-s",
                "--connect-timeout", "10",
                "--max-time", "15",
                `https://api.github.com/repos/${repo}/compare/${before}...${head}`
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
                    console.error(`Compare API error: ${errorOutput}`);
                    reject(new Error(`Failed to fetch compare data`));
                    return;
                }

                try {
                    const data = JSON.parse(output);
                    if (data.message === "Not Found") {
                        resolve(0);
                        return;
                    }
                    const commitCount = data.total_commits || data.commits?.length || 0;
                    resolve(commitCount);
                } catch (e) {
                    reject(new Error(`Failed to parse compare response`));
                }
            });

            curl.on("error", (err) => {
                reject(new Error(`Network error: ${err.message}`));
            });
        });
    }

    async getTodayCommits(username) {
        try {
            console.log(`[DEBUG] Fetching commits for ${username}...`);
            const events = await this.getUserEvents(username);
            const todayBD = this.getBangladeshDate();
            
            console.log(`[DEBUG] Today's Bangladesh date: ${todayBD}`);
            console.log(`[DEBUG] Total events received: ${events.length}`);
            
            let totalCommits = 0;
            let pushCount = 0;
            
            // Filter push events first
            const pushEvents = events.filter(event => event.type === "PushEvent");
            console.log(`[DEBUG] Push events found: ${pushEvents.length}`);
            
            for (const event of pushEvents) {
                const eventDate = this.getBangladeshDate(new Date(event.created_at).getTime());
                console.log(`[DEBUG] Event date: ${eventDate}, repo: ${event.repo.name}`);
                
                if (eventDate === todayBD) {
                    const repo = event.repo.name;
                    const before = event.payload.before;
                    const head = event.payload.head;
                    
                    console.log(`[DEBUG] Processing push - repo: ${repo}, before: ${before.substring(0, 7)}..., head: ${head.substring(0, 7)}...`);
                    
                    // Skip if before is all zeros (new branch/first push)
                    if (before === "0000000000000000000000000000000000000000") {
                        console.log(`[DEBUG] Skipping - new branch creation`);
                        continue;
                    }
                    
                    const commitCount = await this.getCommitsBetween(repo, before, head);
                    console.log(`[DEBUG] Commits in this push: ${commitCount}`);
                    totalCommits += commitCount;
                    pushCount++;
                }
            }
            
            console.log(`[DEBUG] ${username}: ${totalCommits} commits from ${pushCount} push(es) on ${todayBD}`);
            return totalCommits;
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
            
            let totalCommits = 0;
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventDate = new Date(new Date(event.created_at).getTime() + this.timezoneOffset);
                    
                    if (eventDate >= weekAgoBD) {
                        const repo = event.repo.name;
                        const before = event.payload.before;
                        const head = event.payload.head;
                        
                        if (before === "0000000000000000000000000000000000000000") {
                            continue;
                        }
                        
                        const commitCount = await this.getCommitsBetween(repo, before, head);
                        totalCommits += commitCount;
                    }
                }
            }
            
            return totalCommits;
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
            
            // Get unique dates of pushes (in Bangladesh timezone)
            const dates = [...new Set(pushEvents.map(event => 
                this.getBangladeshDate(new Date(event.created_at).getTime())
            ))];
            
            dates.sort().reverse();
            
            let streak = 1;
            const todayBD = this.getBangladeshDate();
            const yesterdayBD = this.getBangladeshDate(Date.now() - 86400000);
            
            // Check if there's any activity today or yesterday
            if (!dates.includes(todayBD) && !dates.includes(yesterdayBD)) {
                return 0;
            }
            
            // Calculate consecutive days
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