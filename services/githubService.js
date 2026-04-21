const https = require("https");

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

    getBangladeshDateTime(timestamp = Date.now()) {
        const bangladeshTime = new Date(timestamp + this.timezoneOffset);
        const year = bangladeshTime.getUTCFullYear();
        const month = String(bangladeshTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bangladeshTime.getUTCDate()).padStart(2, '0');
        
        let hours = bangladeshTime.getUTCHours();
        const minutes = String(bangladeshTime.getUTCMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        
        return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
    }

    async fetchJSON(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = "";
                
                response.on("data", (chunk) => {
                    data += chunk;
                });
                
                response.on("end", () => {
                    try {
                        const json = JSON.parse(data);
                        if (response.statusCode === 404) {
                            reject(new Error("Not Found"));
                            return;
                        }
                        if (response.statusCode === 403 && data.includes("rate limit")) {
                            reject(new Error("API rate limit exceeded"));
                            return;
                        }
                        if (response.statusCode !== 200) {
                            reject(new Error(`HTTP ${response.statusCode}: ${data.substring(0, 100)}`));
                            return;
                        }
                        resolve(json);
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                });
            }).on("error", (err) => {
                reject(new Error(`Network error: ${err.message}`));
            });
        });
    }

    async getUserEvents(username) {
        try {
            const url = `https://api.github.com/users/${username}/events`;
            console.log(`[DEBUG] Fetching events from: ${url}`);
            const events = await this.fetchJSON(url);
            console.log(`[DEBUG] Fetched ${events.length} events for ${username}`);
            return events;
        } catch (error) {
            console.error(`Error fetching events for ${username}:`, error.message);
            throw error;
        }
    }

    async getCommitsBetween(repo, before, head) {
        try {
            const url = `https://api.github.com/repos/${repo}/compare/${before}...${head}`;
            const data = await this.fetchJSON(url);
            const commitCount = data.total_commits || data.commits?.length || 0;
            return commitCount;
        } catch (error) {
            console.error(`Compare API error for ${repo}:`, error.message);
            return 0;
        }
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