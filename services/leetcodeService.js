const { LeetCode } = require("leetcode-query");

class LeetCodeService {
    constructor() {
        this.api = new LeetCode();
        this.settings = new Map();
    }

    setDailyChannel(guildId, channelId) {
        this.settings.set(guildId, { channelId, enabled: true });
        return true;
    }

    disableDaily(guildId) {
        if (this.settings.has(guildId)) {
            this.settings.delete(guildId);
            return true;
        }
        return false;
    }

    getDailyChannel(guildId) {
        const setting = this.settings.get(guildId);
        return setting ? setting.channelId : null;
    }

    isDailyEnabled(guildId) {
        return this.settings.has(guildId);
    }

    async getDailyChallenge() {
        try {
            const daily = await this.api.daily();
            return daily;
        } catch (error) {
            console.error("Error fetching daily challenge:", error);
            throw error;
        }
    }

    formatDailyChallenge(dailyData) {
        const problem = dailyData.question;
        
        let content = `[ LeetCode Daily Challenge ]\n`;
        content += `\n`;
        content += `Title: ${problem.title}\n`;
        content += `\n`;
        content += `Difficulty: ${problem.difficulty}\n`;
        content += `\n`;
        content += `Date: ${dailyData.date}\n`;
        content += `\n`;
        content += `Topics: ${problem.topicTags.map(tag => tag.name).join(", ")}\n`;
        content += `\n`;
        content += `Link: https://leetcode.com/problems/${problem.titleSlug}/\n`;
        content += `\n`;
        content += `Click the link above to submit your solution!`;
        
        return content;
    }

    splitMessage(content, maxLength = 2000) {
        if (content.length <= maxLength) {
            return [content];
        }

        const messages = [];
        let currentMessage = "";
        
        const lines = content.split('\n');
        
        for (const line of lines) {
            if ((currentMessage + '\n' + line).length > maxLength) {
                if (currentMessage) {
                    messages.push(currentMessage);
                    currentMessage = "";
                }
                
                if (line.length > maxLength) {
                    let remaining = line;
                    while (remaining.length > maxLength) {
                        let splitIndex = remaining.lastIndexOf(' ', maxLength);
                        if (splitIndex === -1) splitIndex = maxLength;
                        messages.push(remaining.substring(0, splitIndex));
                        remaining = remaining.substring(splitIndex);
                    }
                    if (remaining) {
                        currentMessage = remaining;
                    }
                } else {
                    currentMessage = line;
                }
            } else {
                if (currentMessage) {
                    currentMessage += '\n' + line;
                } else {
                    currentMessage = line;
                }
            }
        }
        
        if (currentMessage) {
            messages.push(currentMessage);
        }
        
        return messages;
    }

    async sendDailyChallenge(channel) {
        try {
            const daily = await this.getDailyChallenge();
            const formattedContent = this.formatDailyChallenge(daily);
            const messages = this.splitMessage(formattedContent);
            
            for (let i = 0; i < messages.length; i++) {
                let prefix = "";
                if (messages.length > 1) {
                    prefix = `(Part ${i + 1}/${messages.length})\n`;
                }
                await channel.send(prefix + messages[i]);
            }
            
            return true;
        } catch (error) {
            console.error("Error sending daily challenge:", error);
            throw error;
        }
    }
}

module.exports = new LeetCodeService();