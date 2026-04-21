class GitHubService {
    constructor() {
        // Bangladesh timezone offset (UTC+6)
        this.timezoneOffset = 6 * 60 * 60 * 1000;
    }

    async fetchJSON(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Luno-Bot",
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            if (!response.ok) {
                console.error(`GitHub API Error ${response.status} for ${url}`);
                throw new Error(`GitHub API Error ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error(`Fetch error for ${url}:`, err.message);
            throw err;
        }
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

    async getUserRepos(username) {
        try {
            const url = `${this.baseURL}/users/${username}/repos?per_page=100`;
            console.log(`[DEBUG] Fetching repos from: ${url}`);
            const repos = await this.fetchJSON(url);
            console.log(`[DEBUG] Found ${repos.length} repos for ${username}`);
            return repos;
        } catch (err) {
            console.error(`Repo fetch error for ${username}:`, err.message);
            return [];
        }
    }

    async getRepoCommits(repoFullName, username, since, until) {
        try {
            const url = `${this.baseURL}/repos/${repoFullName}/commits?author=${username}&since=${since}&until=${until}&per_page=100`;
            const commits = await this.fetchJSON(url);
            return commits.length;
        } catch (err) {
            console.error(`Commit fetch error for ${repoFullName}:`, err.message);
            return 0;
        }
    }

    async getTodayCommits(username) {
        try {
            console.log(`[DEBUG] Accurate commit fetch for ${username}`);

            const { since, until } = this.getTodayRangeBD();
            console.log(`[DEBUG] Date range: ${since} to ${until}`);

            const repos = await this.getUserRepos(username);

            if (!repos.length) {
                console.log(`[DEBUG] No repos found for ${username}`);
                return 0;
            }

            let total = 0;

            for (const repo of repos) {
                const count = await this.getRepoCommits(
                    repo.full_name,
                    username,
                    since,
                    until
                );
                total += count;
                if (count > 0) {
                    console.log(`[DEBUG] ${repo.full_name}: ${count} commits today`);
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
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const since = weekAgo.toISOString();
            const until = now.toISOString();

            console.log(`[DEBUG] Weekly range: ${since} to ${until}`);

            const repos = await this.getUserRepos(username);

            if (!repos.length) {
                return 0;
            }

            let total = 0;

            for (const repo of repos) {
                const count = await this.getRepoCommits(
                    repo.full_name,
                    username,
                    since,
                    until
                );
                total += count;
            }

            console.log(`[DEBUG] ${username} → ${total} commits this week`);
            return total;

        } catch (err) {
            console.error(`Weekly error:`, err.message);
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            console.log(`[DEBUG] Calculating streak for ${username}`);
            const repos = await this.getUserRepos(username);

            if (!repos.length) {
                return 0;
            }

            let streak = 0;
            const today = new Date();

            for (let i = 0; i < 30; i++) {
                const day = new Date(today);
                day.setDate(today.getDate() - i);
                day.setUTCHours(0, 0, 0, 0);
                
                const since = day.toISOString();
                const until = new Date(day.getTime() + 86400000 - 1).toISOString();

                let commits = 0;

                for (const repo of repos) {
                    commits += await this.getRepoCommits(
                        repo.full_name,
                        username,
                        since,
                        until
                    );
                }

                if (commits > 0) {
                    streak++;
                } else {
                    break;
                }
            }

            console.log(`[DEBUG] ${username} → ${streak} day streak`);
            return streak;
        } catch (error) {
            console.error(`Error fetching streak for ${username}:`, error.message);
            return 0;
        }
    }
}

module.exports = new GitHubService();