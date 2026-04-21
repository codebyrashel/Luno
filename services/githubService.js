class GitHubService {
    constructor() {
        this.userAgent = "Luno-Bot/1.0";
    }

    async fetchJSON(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            if (!response.ok) {
                if (response.status === 404) return [];
                if (response.status === 403) {
                    console.error(`GitHub API rate limit hit. Try again later.`);
                    return [];
                }
                return [];
            }

            return await response.json();
        } catch (err) {
            console.error(`Fetch error: ${err.message}`);
            return [];
        }
    }

    // Get today's date range in Bangladesh time (UTC+6)
    getTodayRange() {
        const now = new Date();
        // Convert to Bangladesh time
        const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        
        // Start of today in BD (midnight)
        const startBD = new Date(Date.UTC(
            bdNow.getUTCFullYear(),
            bdNow.getUTCMonth(),
            bdNow.getUTCDate(),
            0, 0, 0
        ));
        
        // End of today in BD (11:59:59 PM)
        const endBD = new Date(Date.UTC(
            bdNow.getUTCFullYear(),
            bdNow.getUTCMonth(),
            bdNow.getUTCDate(),
            23, 59, 59
        ));
        
        // Convert back to UTC for API
        return {
            since: new Date(startBD.getTime() - 6 * 60 * 60 * 1000).toISOString(),
            until: new Date(endBD.getTime() - 6 * 60 * 60 * 1000).toISOString()
        };
    }

    async getTodayCommits(username) {
        try {
            console.log(`[DEBUG] Fetching today's commits for ${username}...`);
            
            const { since, until } = this.getTodayRange();
            
            // Get user's events (most efficient way)
            const eventsUrl = `https://api.github.com/users/${username}/events`;
            const events = await this.fetchJSON(eventsUrl);
            
            if (!events.length) {
                console.log(`[DEBUG] No events found for ${username}`);
                return 0;
            }
            
            let totalCommits = 0;
            const todayBD = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    // Convert event time to BD time
                    const eventBD = new Date(new Date(event.created_at).getTime() + 6 * 60 * 60 * 1000);
                    const eventDate = eventBD.toISOString().split('T')[0];
                    
                    if (eventDate === todayBD) {
                        const commits = event.payload.commits || [];
                        totalCommits += commits.length;
                    }
                }
            }
            
            console.log(`[DEBUG] Total commits today: ${totalCommits}`);
            return totalCommits;
        } catch (err) {
            console.error(`Error in getTodayCommits: ${err.message}`);
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const events = await this.fetchJSON(`https://api.github.com/users/${username}/events`);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            let totalCommits = 0;
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventDate = new Date(event.created_at);
                    if (eventDate >= weekAgo) {
                        const commits = event.payload.commits || [];
                        totalCommits += commits.length;
                    }
                }
            }
            
            return totalCommits;
        } catch (err) {
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            const events = await this.fetchJSON(`https://api.github.com/users/${username}/events`);
            const pushDates = new Set();
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const bdTime = new Date(new Date(event.created_at).getTime() + 6 * 60 * 60 * 1000);
                    const dateStr = bdTime.toISOString().split('T')[0];
                    pushDates.add(dateStr);
                }
            }
            
            const dates = Array.from(pushDates).sort().reverse();
            if (dates.length === 0) return 0;
            
            let streak = 1;
            const todayBD = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().split('T')[0];
            const yesterdayBD = new Date(Date.now() + 6 * 60 * 60 * 1000 - 86400000).toISOString().split('T')[0];
            
            if (!dates.includes(todayBD) && !dates.includes(yesterdayBD)) {
                return 0;
            }
            
            for (let i = 0; i < dates.length - 1; i++) {
                const current = new Date(dates[i]);
                const next = new Date(dates[i + 1]);
                const diff = (current - next) / (1000 * 60 * 60 * 24);
                
                if (diff === 1) {
                    streak++;
                } else {
                    break;
                }
            }
            
            return streak;
        } catch (err) {
            return 0;
        }
    }
}

module.exports = new GitHubService();