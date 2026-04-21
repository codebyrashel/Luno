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
                if (response.status === 404) return null;
                if (response.status === 403) {
                    const remaining = response.headers.get("X-RateLimit-Remaining");
                    if (remaining === "0") {
                        console.error("GitHub API rate limit exceeded");
                    }
                }
                return null;
            }

            return await response.json();
        } catch (err) {
            console.error(`Fetch error: ${err.message}`);
            return null;
        }
    }

    async getAllRepos(username) {
        let page = 1;
        let allRepos = [];
        
        while (true) {
            const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`;
            const repos = await this.fetchJSON(url);
            
            if (!repos || repos.length === 0) break;
            
            allRepos = allRepos.concat(repos);
            page++;
        }
        
        return allRepos;
    }

    async getCommitsForRepo(repoFullName, username, since, until) {
        let page = 1;
        let allCommits = [];
        
        while (true) {
            const url = `https://api.github.com/repos/${repoFullName}/commits?author=${username}&since=${since}&until=${until}&per_page=100&page=${page}`;
            const commits = await this.fetchJSON(url);
            
            if (!commits || commits.length === 0) break;
            
            allCommits = allCommits.concat(commits);
            page++;
        }
        
        return allCommits;
    }

    getBangladeshDateRange() {
        const now = new Date();
        const bdOffset = 6 * 60 * 60 * 1000;
        
        const startBD = new Date(now.getTime() + bdOffset);
        startBD.setUTCHours(0, 0, 0, 0);
        const startUTC = new Date(startBD.getTime() - bdOffset);
        
        const endBD = new Date(now.getTime() + bdOffset);
        endBD.setUTCHours(23, 59, 59, 999);
        const endUTC = new Date(endBD.getTime() - bdOffset);
        
        return {
            since: startUTC.toISOString(),
            until: endUTC.toISOString()
        };
    }

    async getTodayCommits(username) {
        try {
            console.log(`[DEBUG] Fetching today's commits for ${username}...`);
            
            const repos = await this.getAllRepos(username);
            if (!repos.length) {
                console.log(`[DEBUG] No repos found for ${username}`);
                return 0;
            }
            
            const { since, until } = this.getBangladeshDateRange();
            console.log(`[DEBUG] Date range: ${since} to ${until}`);
            
            let totalCommits = 0;
            
            for (const repo of repos) {
                const commits = await this.getCommitsForRepo(repo.full_name, username, since, until);
                totalCommits += commits.length;
                if (commits.length > 0) {
                    console.log(`[DEBUG] ${repo.full_name}: ${commits.length} commits today`);
                }
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
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
            console.log(`[DEBUG] Fetching weekly commits for ${username}...`);
            
            const repos = await this.getAllRepos(username);
            if (!repos.length) return 0;
            
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const since = weekAgo.toISOString();
            const until = new Date().toISOString();
            
            let totalCommits = 0;
            
            for (const repo of repos) {
                const commits = await this.getCommitsForRepo(repo.full_name, username, since, until);
                totalCommits += commits.length;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`[DEBUG] Total weekly commits: ${totalCommits}`);
            return totalCommits;
        } catch (err) {
            console.error(`Error in getWeeklyCommits: ${err.message}`);
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            console.log(`[DEBUG] Calculating streak for ${username}...`);
            
            const repos = await this.getAllRepos(username);
            if (!repos.length) return 0;
            
            let streak = 0;
            const today = new Date();
            
            for (let i = 0; i < 365; i++) {
                const day = new Date(today);
                day.setDate(today.getDate() - i);
                
                const startUTC = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0));
                const endUTC = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59));
                
                let commitsToday = 0;
                
                for (const repo of repos) {
                    const commits = await this.getCommitsForRepo(repo.full_name, username, startUTC.toISOString(), endUTC.toISOString());
                    commitsToday += commits.length;
                }
                
                if (commitsToday > 0) {
                    streak++;
                } else {
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            console.log(`[DEBUG] Current streak: ${streak} days`);
            return streak;
        } catch (err) {
            console.error(`Error in getContributionStreak: ${err.message}`);
            return 0;
        }
    }
}

module.exports = new GitHubService();