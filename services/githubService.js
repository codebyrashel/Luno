class GitHubService {
    constructor() {
        // No baseURL - use full URLs directly
    }

    async fetchJSON(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Luno-Bot/1.0",
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                if (response.status === 403) {
                    const text = await response.text();
                    if (text.includes("rate limit")) {
                        console.error("GitHub API rate limit exceeded");
                        return null;
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error(`Fetch error: ${err.message}`);
            return null;
        }
    }

    async getUserEvents(username) {
        const url = `https://api.github.com/users/${username}/events`;
        const events = await this.fetchJSON(url);
        return events || [];
    }

    async getTodayCommits(username) {
        try {
            const events = await this.getUserEvents(username);
            const today = new Date();
            const bangladeshDate = new Date(today.getTime() + 6 * 60 * 60 * 1000);
            const todayStr = bangladeshDate.toISOString().split('T')[0];
            
            let totalCommits = 0;
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventDate = new Date(event.created_at);
                    const eventBD = new Date(eventDate.getTime() + 6 * 60 * 60 * 1000);
                    const eventDateStr = eventBD.toISOString().split('T')[0];
                    
                    if (eventDateStr === todayStr) {
                        const commits = event.payload.commits || [];
                        totalCommits += commits.length;
                    }
                }
            }
            
            return totalCommits;
        } catch (err) {
            console.error(`Error in getTodayCommits: ${err.message}`);
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const events = await this.getUserEvents(username);
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
            console.error(`Error in getWeeklyCommits: ${err.message}`);
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            const events = await this.getUserEvents(username);
            const pushDates = new Set();
            
            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventBD = new Date(new Date(event.created_at).getTime() + 6 * 60 * 60 * 1000);
                    const dateStr = eventBD.toISOString().split('T')[0];
                    pushDates.add(dateStr);
                }
            }
            
            const dates = Array.from(pushDates).sort().reverse();
            if (dates.length === 0) return 0;
            
            let streak = 1;
            const today = new Date();
            const todayBD = new Date(today.getTime() + 6 * 60 * 60 * 1000).toISOString().split('T')[0];
            const yesterday = new Date(today.getTime() - 86400000);
            const yesterdayBD = new Date(yesterday.getTime() + 6 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            if (!dates.includes(todayBD) && !dates.includes(yesterdayBD)) {
                return 0;
            }
            
            for (let i = 0; i < dates.length - 1; i++) {
                const current = new Date(dates[i]);
                const next = new Date(dates[i + 1]);
                const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));
                
                if (diff === 1) {
                    streak++;
                } else {
                    break;
                }
            }
            
            return streak;
        } catch (err) {
            console.error(`Error in getContributionStreak: ${err.message}`);
            return 0;
        }
    }
}

module.exports = new GitHubService();