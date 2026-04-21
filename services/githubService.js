const { spawn } = require("child_process");

class GitHubService {
    async fetchJSON(url) {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Luno-Bot",
                "Accept": "application/vnd.github.v3+json"
            }
        });
        if (!response.ok) return null;
        return response.json();
    }

    async getTodayCommits(username) {
        try {
            const events = await this.fetchJSON(`https://api.github.com/users/${username}/events`);
            if (!events) return 0;

            // Get today's date in Bangladesh time (UTC+6)
            const now = new Date();
            const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
            const todayStr = bdNow.toISOString().split('T')[0];
            
            let totalCommits = 0;

            for (const event of events) {
                if (event.type === "PushEvent") {
                    // Check if event happened today in BD time
                    const eventBD = new Date(new Date(event.created_at).getTime() + 6 * 60 * 60 * 1000);
                    const eventDateStr = eventBD.toISOString().split('T')[0];
                    
                    if (eventDateStr === todayStr) {
                        const repo = event.repo.name;
                        const before = event.payload.before;
                        const head = event.payload.head;
                        
                        // Skip new branch creation (before is all zeros)
                        if (before === "0000000000000000000000000000000000000000") {
                            continue;
                        }
                        
                        // Get commit count from Compare API
                        const compareUrl = `https://api.github.com/repos/${repo}/compare/${before}...${head}`;
                        const compareData = await this.fetchJSON(compareUrl);
                        
                        if (compareData && compareData.total_commits) {
                            totalCommits += compareData.total_commits;
                        }
                    }
                }
            }
            
            return totalCommits;
        } catch (err) {
            console.error(`Error: ${err.message}`);
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const events = await this.fetchJSON(`https://api.github.com/users/${username}/events`);
            if (!events) return 0;

            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            let totalCommits = 0;

            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventDate = new Date(event.created_at);
                    if (eventDate >= weekAgo) {
                        const repo = event.repo.name;
                        const before = event.payload.before;
                        const head = event.payload.head;
                        
                        if (before === "0000000000000000000000000000000000000000") {
                            continue;
                        }
                        
                        const compareUrl = `https://api.github.com/repos/${repo}/compare/${before}...${head}`;
                        const compareData = await this.fetchJSON(compareUrl);
                        
                        if (compareData && compareData.total_commits) {
                            totalCommits += compareData.total_commits;
                        }
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
            if (!events) return 0;

            const commitDays = new Set();

            for (const event of events) {
                if (event.type === "PushEvent") {
                    const eventBD = new Date(new Date(event.created_at).getTime() + 6 * 60 * 60 * 1000);
                    const dateStr = eventBD.toISOString().split('T')[0];
                    commitDays.add(dateStr);
                }
            }

            const dates = Array.from(commitDays).sort().reverse();
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