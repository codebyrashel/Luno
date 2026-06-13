const vc247Service = require("../services/vc247Service");

module.exports = async (oldState, newState, vcTracker, smartVCService, musicService, client) => {
    console.log(`Voice state update: ${oldState.channelId} -> ${newState.channelId} for user ${newState.member?.id}`);
    const userId = newState.member?.id;
    if (!userId || newState.member.user.bot) return;

    const oldVC = oldState.channelId;
    const newVC = newState.channelId;
    const oldMuted = oldState.selfMute || oldState.serverMute;
    const newMuted = newState.selfMute || newState.serverMute;
    const isCounting = !newMuted;

    const smartConfig = smartVCService.getStatus(newState.guild.id);
    const smartChannelId = smartConfig && smartConfig.enabled ? smartConfig.channelId : null;
    const oldInSmart = oldVC === smartChannelId;
    const newInSmart = newVC === smartChannelId;

    if (!oldInSmart && !newInSmart) {
        if (!oldVC && newVC) {
            vcTracker.joinVC(userId, isCounting);
        }

        if (oldVC && !newVC) {
            vcTracker.leaveVC(userId);
        }

        if (oldVC && newVC && oldVC !== newVC) {
            vcTracker.leaveVC(userId);
            vcTracker.joinVC(userId, isCounting);
        }

        if (oldVC && newVC && oldVC === newVC) {
            if (oldMuted && !newMuted) {
                vcTracker.joinVC(userId, true);
            }
            if (!oldMuted && newMuted) {
                vcTracker.leaveVC(userId);
            }
        }
    } else if (oldInSmart && !newInSmart) {
        vcTracker.leaveVC(userId);
        if (newVC) {
            vcTracker.joinVC(userId, isCounting);
        }
    }

    smartVCService.voiceStateUpdate(oldState, newState);

    // Auto-disconnect bot when no users in voice channel unless 24/7 mode is enabled for this channel
    const botNewChannel = newState.guild.members.me?.voice.channel;
    const vc247Config = vc247Service.getStatus(newState.guild.id);
    const is247Active = vc247Config?.enabled && botNewChannel?.id === vc247Config.channelId;

    if (botNewChannel && !is247Active) {
        const members = botNewChannel.members.filter(member => !member.user.bot);
        if (members.size === 0) {
            setTimeout(() => {
                const currentMembers = botNewChannel.members.filter(member => !member.user.bot);
                if (currentMembers.size === 0) {
                    musicService.stop(newState.guild);
                }
            }, 30000);
        }
    }
};