const { spawn } = require("child_process");

class GitHubService {
    constructor() {
        // Bangladesh timezone offset (UTC+6)
        this.timezoneOffset = 6 * 60 * 60 * 1000;
    }

    async fetchJSON(url) {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Luno-Bot",
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API Error ${response.status}`);
        }

        return response.json();
    }

    getTodayRangeBD() {
        const now = new Date();
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
            const repos = await this.fetchJSON(url);
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
            return 0;
        }
    }

    async getTodayCommits(username) {
        try {
            const { since, until } = this.getTodayRangeBD();
            const repos = await this.getUserRepos(username);

            if (!repos.length) return 0;

            let total = 0;
            for (const repo of repos) {
                const count = await this.getRepoCommits(repo.full_name, username, since, until);
                total += count;
            }
            return total;
        } catch (err) {
            return 0;
        }
    }

    async getWeeklyCommits(username) {
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const since = weekAgo.toISOString();
            const until = now.toISOString();

            const repos = await this.getUserRepos(username);
            if (!repos.length) return 0;

            let total = 0;
            for (const repo of repos) {
                const count = await this.getRepoCommits(repo.full_name, username, since, until);
                total += count;
            }
            return total;
        } catch (err) {
            return 0;
        }
    }

    async getContributionStreak(username) {
        try {
            const repos = await this.getUserRepos(username);
            if (!repos.length) return 0;

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
                    commits += await this.getRepoCommits(repo.full_name, username, since, until);
                }

                if (commits > 0) {
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