const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const goalService = require("../services/goalService");

async function handleSelectMenu(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    
    if (interaction.customId === "goal_action_select") {
        const action = interaction.values[0];
        const context = interaction.client.goalContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /goal again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const userId = context.userId;
        
        try {
            await interaction.message.delete();
        } catch (e) {}
        
        switch (action) {
            case "set":
                const activeGoal = goalService.getActiveGoal(userId);
                if (activeGoal) {
                    const msg = await interaction.reply({ 
                        content: "You already have an active goal. Complete or cancel it before setting a new one.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const modal = new ModalBuilder()
                    .setCustomId("goal_set_modal")
                    .setTitle("Set New Goal");
                
                const descriptionInput = new TextInputBuilder()
                    .setCustomId("goal_description")
                    .setLabel("Goal Description")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Describe your goal (e.g., Complete 5 LeetCode problems, Finish project, etc.)")
                    .setRequired(true)
                    .setMinLength(5)
                    .setMaxLength(500);
                
                const daysInput = new TextInputBuilder()
                    .setCustomId("goal_days")
                    .setLabel("Days to complete")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Enter number of days (e.g., 7, 14, 30)")
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(3);
                
                const firstRow = new ActionRowBuilder().addComponents(descriptionInput);
                const secondRow = new ActionRowBuilder().addComponents(daysInput);
                modal.addComponents(firstRow, secondRow);
                
                await interaction.showModal(modal);
                
                interaction.client.goalModalContext = {
                    userId,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId
                };
                break;
                
            case "status":
                const goalData = goalService.getGoalStatus(userId);
                const currentGoal = goalData.goal;
                const currentStreak = goalData.streak;
                
                if (!currentGoal) {
                    const msg = await interaction.reply({ 
                        content: "You have no active goal. Use 'Set New Goal' to create one.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const due = new Date(currentGoal.dueAt);
                const dueDate = due.toUTCString();
                const updatesCount = currentGoal.updates.length;
                const daysLeft = Math.ceil((currentGoal.dueAt - Date.now()) / (1000 * 60 * 60 * 24));
                
                const statusMsg = await interaction.reply({ 
                    content: `Active Goal: ${currentGoal.description}\n\nDue: ${dueDate} UTC (${daysLeft} days left)\nProgress updates: ${updatesCount}\nCurrent streak: ${currentStreak.current} days\nBest streak: ${currentStreak.best} days`,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await statusMsg.delete();
                    } catch (e) {}
                }, 15000);
                break;
                
            case "update":
                const activeGoalCheck = goalService.getActiveGoal(userId);
                
                if (!activeGoalCheck) {
                    const msg = await interaction.reply({ 
                        content: "You have no active goal. Use 'Set New Goal' to create one first.",
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const updateModal = new ModalBuilder()
                    .setCustomId("goal_update_modal")
                    .setTitle("Update Goal Progress");
                
                const progressInput = new TextInputBuilder()
                    .setCustomId("goal_progress")
                    .setLabel("Progress Update")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Describe what progress you made (e.g., Solved 2 problems, Completed chapter 3, etc.)")
                    .setRequired(true)
                    .setMinLength(3)
                    .setMaxLength(500);
                
                const progressRow = new ActionRowBuilder().addComponents(progressInput);
                updateModal.addComponents(progressRow);
                
                await interaction.showModal(updateModal);
                
                interaction.client.goalUpdateContext = {
                    userId
                };
                break;
                
            case "complete":
                const completeResult = goalService.completeGoal(userId);
                
                if (completeResult.error) {
                    const msg = await interaction.reply({ 
                        content: completeResult.error,
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const userStreak = goalService.getStreak(userId);
                const completeMsg = await interaction.reply({ 
                    content: `Goal completed: ${completeResult.goal.description}\n\nStreak: ${userStreak.current} days (best: ${userStreak.best})\nGreat work!`,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await completeMsg.delete();
                    } catch (e) {}
                }, 10000);
                break;
                
            case "cancel":
                const cancelResult = goalService.cancelGoal(userId);
                
                if (cancelResult.error) {
                    const msg = await interaction.reply({ 
                        content: cancelResult.error,
                        flags: 64 
                    });
                    setTimeout(async () => {
                        try {
                            await msg.delete();
                        } catch (e) {}
                    }, 5000);
                    return true;
                }
                
                const cancelMsg = await interaction.reply({ 
                    content: `Goal cancelled: ${cancelResult.goal.description}`,
                    flags: 64 
                });
                setTimeout(async () => {
                    try {
                        await cancelMsg.delete();
                    } catch (e) {}
                }, 5000);
                break;
        }
        
        delete interaction.client.goalContext;
        
        return true;
    }
    
    return false;
}

async function handleModal(interaction) {
    if (!interaction.isModalSubmit()) return false;
    
    if (interaction.customId === "goal_set_modal") {
        const description = interaction.fields.getTextInputValue("goal_description");
        const days = parseInt(interaction.fields.getTextInputValue("goal_days"));
        const context = interaction.client.goalModalContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /goal again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        if (isNaN(days) || days < 1 || days > 365) {
            const msg = await interaction.reply({ 
                content: "Please enter a valid number of days (1 to 365).",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const result = goalService.createGoal(context.userId, context.guildId, context.channelId, description, days);
        
        if (result.error) {
            const msg = await interaction.reply({ 
                content: result.error,
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 5000);
            return true;
        }
        
        const msg = await interaction.reply({ 
            content: `Goal set: ${description}\nDue in ${days} day(s). I will remind you 5 times per day and ask for progress 3 times daily.`,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 10000);
        
        delete interaction.client.goalModalContext;
        return true;
    }
    
    if (interaction.customId === "goal_update_modal") {
        const progress = interaction.fields.getTextInputValue("goal_progress");
        const context = interaction.client.goalUpdateContext;
        
        if (!context) {
            const msg = await interaction.reply({ 
                content: "Session expired. Please use /goal again.",
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 3000);
            return true;
        }
        
        const result = goalService.updateGoal(context.userId, progress);
        
        if (result.error) {
            const msg = await interaction.reply({ 
                content: result.error,
                flags: 64 
            });
            setTimeout(async () => {
                try {
                    await msg.delete();
                } catch (e) {}
            }, 5000);
            return true;
        }
        
        const msg = await interaction.reply({ 
            content: `Progress recorded for <@${context.userId}>:\n${progress}\nKeep the momentum going!`,
            flags: 64 
        });
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (e) {}
        }, 8000);
        
        delete interaction.client.goalUpdateContext;
        return true;
    }
    
    return false;
}

module.exports = async (interaction) => {
    if (interaction.isModalSubmit()) {
        return await handleModal(interaction);
    }
    return await handleSelectMenu(interaction);
};