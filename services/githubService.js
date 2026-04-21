const { spawn } = require("child_process");

class GitHubService {
    constructor() {
        this.userAgent = "Luno-Bot/1.0";
        this.cache = new Map();
        this.requestCount = 0;
        this.lastRequestTime = 0;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchJSON(url) {
        // Check cache first (5 minute cache)
        const cacheKey = url;
        if (this.cache.has(cacheKey)) {
            const { data, timestamp } = this.cache.get(cacheKey);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                return data;
            }
        }

        // Rate limiting - max 1 request per second
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < 1000) {
            await this.delay(1000 - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            // Check rate limit headers
            const remaining = response.headers.get("X-RateLimit-Remaining");
            if (remaining === "0") {
                const resetTime = parseInt(response.headers.get("X-RateLimit-Reset")) * 1000;
                const waitTime = resetTime - Date.now() + 5000;
                console.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
                await this.delay(waitTime);
                return this.fetchJSON(url); // Retry after waiting
            }

            if (!response.ok) {
                if (response.status === 404) return null;
                if (response.status === 403) {
                    console.error(`GitHub API forbidden for ${url}`);
                    return null;
                }
                return null;
            }

            const data = await response.json();
            
            // Cache the result
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            
            return data;
        } catch (err) {
            console.error(`Fetch error: ${err.message}`);
            return null;
        }
    }

    async getAllRepos(username) {
        const cacheKey = `repos_${username}`;
        if (this.cache.has(cacheKey)) {
            const { data, timestamp } = this.cache.get(cacheKey);
            if (Date.now() - timestamp < 10 * 60 * 1000) {
                return data;
            }
        }

        let page = 1;
        let allRepos = [];
        
        while (true) {
            const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`;
            const repos = await this.fetchJSON(url);
            
            if (!repos || repos.length === 0) break;
            
            allRepos = allRepos.concat(repos);
            page++;
        }
        
        this.cache.set(`repos_${username}`, { data: allRepos, timestamp: Date.now() });
        return allRepos;
    }

    async getCommitsForRepo(repoFullName, username, since, until) {
        const cacheKey = `commits_${repoFullName}_${username}_${since}_${until}`;
        if (this.cache.has(cacheKey)) {
            const { data, timestamp } = this.cache.get(cacheKey);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                return data;
            }
        }

        let page = 1;
        let allCommits = [];
        
        while (true) {
            const url = `https://api.github.com/repos/${repoFullName}/commits?author=${username}&since=${since}&until=${until}&per_page=100&page=${page}`;
            const commits = await this.fetchJSON(url);
            
            if (!commits || commits.length === 0) break;
            
            allCommits = allCommits.concat(commits);
            page++;
        }
        
        this.cache.set(cacheKey, { data: allCommits, timestamp: Date.now() });
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
            
            let totalCommits = 0;
            let repoCount = 0;
            
            for (const repo of repos) {
                const commits = await this.getCommitsForRepo(repo.full_name, username, since, until);
                totalCommits += commits.length;
                if (commits.length > 0) {
                    console.log(`[DEBUG] ${repo.full_name}: ${commits.length} commits today`);
                    repoCount++;
                }
            }
            
            console.log(`[DEBUG] Total commits today: ${totalCommits} from ${repoCount} repos`);
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
            
            for (let i = 0; i < 30; i++) { // Only check last 30 days for performance
                const day = new Date(today);
                day.setDate(today.getDate() - i);
                
                const startUTC = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0));
                const endUTC = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59));
                
                let commitsToday = 0;
                
                for (const repo of repos) {
                    const commits = await this.getCommitsForRepo(repo.full_name, username, startUTC.toISOString(), endUTC.toISOString());
                    commitsToday += commits.length;
                    if (commitsToday > 0) break; // Found commits today, no need to check more repos
                }
                
                if (commitsToday > 0) {
                    streak++;
                } else {
                    break;
                }
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