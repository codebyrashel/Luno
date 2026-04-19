const { spawn } = require("child_process");

class CodeforcesService {
    constructor() {
        this.cache = new Map();
    }

    async getUserSubmissions(handle) {
        return new Promise((resolve, reject) => {
            const curl = spawn("curl", [
                "-s",
                `https://codeforces.com/api/user.status?handle=${handle}`
            ]);

            let output = "";
            curl.stdout.on("data", (data) => {
                output += data.toString();
            });

            curl.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error("Failed to fetch Codeforces submissions"));
                    return;
                }

                try {
                    const data = JSON.parse(output);
                    if (data.status === "FAILED") {
                        reject(new Error(`User ${handle} not found on Codeforces`));
                        return;
                    }
                    resolve(data.result || []);
                } catch (e) {
                    reject(e);
                }
            });

            curl.on("error", reject);
        });
    }

    async getTodaySolved(handle) {
        try {
            const submissions = await this.getUserSubmissions(handle);
            const today = new Date().toISOString().split('T')[0];
            
            const solvedToday = new Set();
            for (const sub of submissions) {
                const subDate = new Date(sub.creationTimeSeconds * 1000).toISOString().split('T')[0];
                if (subDate === today && sub.verdict === "OK") {
                    solvedToday.add(`${sub.problem.contestId}${sub.problem.index}`);
                }
            }
            
            return solvedToday.size;
        } catch (error) {
            console.error(`Error fetching today's solved for ${handle}:`, error.message);
            return 0;
        }
    }

    async getWeeklySolved(handle) {
        try {
            const submissions = await this.getUserSubmissions(handle);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const solvedWeekly = new Set();
            for (const sub of submissions) {
                const subDate = new Date(sub.creationTimeSeconds * 1000);
                if (subDate >= weekAgo && sub.verdict === "OK") {
                    solvedWeekly.add(`${sub.problem.contestId}${sub.problem.index}`);
                }
            }
            
            return solvedWeekly.size;
        } catch (error) {
            console.error(`Error fetching weekly solved for ${handle}:`, error.message);
            return 0;
        }
    }

    async getUserRating(handle) {
        return new Promise((resolve, reject) => {
            const curl = spawn("curl", [
                "-s",
                `https://codeforces.com/api/user.info?handles=${handle}`
            ]);

            let output = "";
            curl.stdout.on("data", (data) => {
                output += data.toString();
            });

            curl.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error("Failed to fetch Codeforces rating"));
                    return;
                }

                try {
                    const data = JSON.parse(output);
                    if (data.status === "FAILED" || !data.result || data.result.length === 0) {
                        resolve(0);
                        return;
                    }
                    resolve(data.result[0].rating || 0);
                } catch (e) {
                    reject(e);
                }
            });

            curl.on("error", reject);
        });
    }
}

module.exports = new CodeforcesService();