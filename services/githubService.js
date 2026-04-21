const https = require("https");

class GitHubService {
    constructor() {
        this.baseURL = "https://api.github.com";
    }

    async fetchJSON(url) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    "User-Agent": "Luno-Bot",
                    "Accept": "application/vnd.github.v3+json"
                }
            };

            https.get(url, options, (res) => {
                let data = "";

                res.on("data", chunk => data += chunk);

                res.on("end", () => {
                    try {
                        const json = JSON.parse(data);

                        if (res.statusCode !== 200) {
                            return reject(new Error(`GitHub API Error ${res.statusCode}`));
                        }

                        resolve(json);
                    } catch (err) {
                        reject(new Error("Failed to parse JSON"));
                    }
                });

            }).on("error", err => reject(err));
        });
    }

    // Get Bangladesh day range in ISO (UTC-safe)
    getTodayRangeBD() {
        const now = new Date();

        // Convert to Bangladesh time
        const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);

        const start = new Date(Date.UTC(
            bd.getUTCFullYear(),
            bd.getUTCMonth(),
            bd.getUTCDate(),
            0, 0, 0
        ));

        const end = new Date(Date.UTC(
            bd.getUTCFullYear(),
            bd.getUTCMonth(),
            bd.getUTCDate(),
            23, 59, 59
        ));

        return {
            since: start.toISOString(),
            until: end.toISOString()
        };
    }

    async getUserRepos(username) {
        try {
            const url = `${this.baseURL}/users/${username}/repos?per_page=100`;
            return await this.fetchJSON(url);
        } catch (err) {
            console.error(`Repo fetch error for ${username}:`, err.message);
            return [];
        }
    }

    async getRepoCommits(repoFullName, username, since, until) {
        try {
            const url = `${this.baseURL}/repos/${repoFullName}/commits?author=${username}&since=${since}&until=${until}`;
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

            const repos = await this.getUserRepos(username);

            if (!repos.length) {
                console.log(`[DEBUG] No repos found`);
                return 0;
            }

            let total = 0;

            // Sequential to avoid rate limit drama on Railway
            for (const repo of repos) {
                const count = await this.getRepoCommits(
                    repo.full_name,
                    username,
                    since,
                    until
                );
                total += count;
            }

            console.log(`[DEBUG] ${username} → ${total} commits today`);
            return total;

        } catch (err) {
            console.error(`Error in getTodayCommits:`, err.message);
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const now = new Date();
            const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const until = now.toISOString();

            const repos = await this.getUserRepos(username);

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

            return total;

        } catch (err) {
            console.error(`Weekly error:`, err.message);
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            const repos = await this.getUserRepos(username);
            const today = new Date();

            let streak = 0;

            for (let i = 0; i < 30; i++) {
                const day = new Date(today.getTime() - i * 86400000);

                const since = new Date(day.setUTCHours(0,0,0,0)).toISOString();
                const until = new Date(day.setUTCHours(23,59,59,999)).toISOString();

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

            return streak;

        } catch (err) {
            console.error(`Streak error:`, err.message);
            return 0;
        }
    }
}

module.exports = new GitHubService();