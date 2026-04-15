const { SlashCommandBuilder } = require("discord.js");
const vcTracker = require("../services/vcTrackerService");

/**
 * Leaderboard command for viewing voice channel activity statistics.
 * Provides VC time leaderboards and weekly level rank details.
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("VC activity and weekly level leaderboard")

        .addSubcommand(cmd =>
            cmd.setName("stats")
                .setDescription("Show your VC stats and level progress")
                .addStringOption(opt =>
                    opt.setName("range")
                        .setDescription("Time range")
                        .setRequired(true)
                        .addChoices(
                            { name: "Last 24 hours", value: "24h" },
                            { name: "Last 7 days", value: "7d" }
                        )
                )
        )
        .addSubcommand(cmd =>
            cmd.setName("vc")
                .setDescription("Show VC time leaderboard")
                .addStringOption(opt =>
                    opt.setName("range")
                        .setDescription("Time range")
                        .setRequired(true)
                        .addChoices(
                            { name: "Last 24 hours", value: "24h" },
                            { name: "Last 7 days", value: "7d" }
                        )
                )
        )
        .addSubcommand(cmd =>
            cmd.setName("level")
                .setDescription("Show weekly level rank")
        ),

    /**
     * Executes the leaderboard command.
     * @param {import("discord.js").CommandInteraction} interaction
     */
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const resetTime = "Monday 00:00 UTC";

        if (sub === "stats") {
            const range = interaction.options.getString("range");
            const time = vcTracker.getTime(userId, range);
            const xp = vcTracker.getXp(userId, range);
            const totalXp = vcTracker.getTotalXp(userId);
            const level = vcTracker.getLevel(totalXp);
            const formatted = vcTracker.formatTime(time);

            return interaction.reply(
                `Your ${range === "24h" ? "24-hour" : "7-day"} VC stats:\n` +
                `• VC time: ${formatted}\n` +
                `• XP earned: ${xp}\n` +
                `• Total XP: ${totalXp}\n` +
                `• Level: ${level}`
            );
        }

        if (sub === "vc") {
            const range = interaction.options.getString("range");
            const data = vcTracker.getLeaderboard(range);

            if (!data || data.length === 0) {
                return interaction.reply("No VC leaderboard data available yet.");
            }

            let text = `VC Leaderboard (${range === "24h" ? "Last 24 hours" : "Last 7 days"}):\n\n`;
            data.forEach(([uid, time], i) => {
                text += `${i + 1}. <@${uid}> - ${vcTracker.formatTime(time)}\n`;
            });

            return interaction.reply(text);
        }

        if (sub === "level") {
            const weeklyXp = vcTracker.getWeeklyXp(userId);
            const totalXp = vcTracker.getTotalXp(userId);
            const level = vcTracker.getLevel(totalXp);
            const toNext = vcTracker.xpToNextLevel(totalXp);
            const rank = vcTracker.getWeeklyRank(userId) || "Unranked";
            const data = vcTracker.getWeeklyLeaderboard();

            let text = `Weekly level rank summary (last 7 days, resets ${resetTime}):\n` +
                `• Current level: ${level}\n` +
                `• Weekly XP: ${weeklyXp}\n` +
                `• XP to next level: ${toNext}\n` +
                `• Your weekly rank: #${rank}\n\n`;

            if (!data || data.length === 0) {
                text += "No weekly ranking data available yet.";
                return interaction.reply(text);
            }

            text += "Top weekly level rank:\n";
            data.forEach(([uid, xp], i) => {
                text += `${i + 1}. <@${uid}> - ${xp} XP\n`;
            });

            return interaction.reply(text);
        }

        return interaction.reply("Invalid leaderboard command.");
    }
};