
const { EmbedBuilder, Events } = require("discord.js");
const guildConfig = require("./guildConfig.json");

// 서버별 초대 링크 캐시
const inviteCache = new Map();

// ==========================================
// 디스코드 시간 표시
// ==========================================
function discordTime(date) {
    if (!date) return "알 수 없음";

    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:F> (<t:${unix}:R>)`;
}

// ==========================================
// 서버별 알림 채널 가져오기
// ==========================================
async function getLogChannel(guild, type) {
    const settings = guildConfig[guild.id];

    if (!settings) return null;

    const channelId = type === "join"
        ? settings.joinChannelId
        : settings.leaveChannelId;

    if (!channelId) return null;

    const channel = await guild.channels
        .fetch(channelId)
        .catch(() => null);

    if (!channel?.isTextBased()) return null;
    if (typeof channel.send !== "function") return null;

    return channel;
}

// ==========================================
// 사용자 배너 가져오기 (GIF 지원)
// ==========================================
async function getUserBanner(user) {
    try {
        const fetchedUser = await user.fetch(true);

        return fetchedUser.bannerURL({
            size: 1024,
            forceStatic: false
        });
    } catch (error) {
        console.warn("배너 조회 실패:", error.message);
        return null;
    }
}

// ==========================================
// 초대 링크 조회
// ==========================================
async function fetchInvites(guild) {
    const invites = await guild.invites.fetch();

    return new Map(
        invites.map(invite => [
            invite.code,
            {
                uses: invite.uses ?? 0,
                inviterId: invite.inviterId ?? invite.inviter?.id ?? null
            }
        ])
    );
}

// ==========================================
// 서버별 초대 링크 캐시 초기화
// ==========================================
async function initializeInvites(guild) {
    if (!guildConfig[guild.id]) return;

    try {
        const invites = await fetchInvites(guild);

        inviteCache.set(guild.id, invites);

        console.log(
            `[${guild.name}] 초대 링크 ${invites.size}개 저장`
        );
    } catch (error) {
        console.warn(
            `[${guild.name}] 초대 링크 조회 실패:`,
            error.message
        );
    }
}

// ==========================================
// 메인 기능
// ==========================================
module.exports = function setupJoinLeave(client) {

    // ======================================
    // 봇 시작
    // ======================================
    client.once(Events.ClientReady, async () => {
        console.log("✅ 멀티 서버 입퇴장 알림 활성화");

        for (const guild of client.guilds.cache.values()) {
            const settings = guildConfig[guild.id];

            if (!settings) {
                console.log(
                    `[${guild.name}] 설정 없음 - 알림 비활성화`
                );
                continue;
            }

            console.log(
                `[${guild.name}] 입장 채널: ${settings.joinChannelId || "미설정"}`
            );

            console.log(
                `[${guild.name}] 퇴장 채널: ${settings.leaveChannelId || "미설정"}`
            );

            await initializeInvites(guild);
        }
    });

    // ======================================
    // 새로운 서버에 봇이 추가됨
    // ======================================
    client.on(Events.GuildCreate, async guild => {
        console.log(
            `[새 서버] ${guild.name} (${guild.id})`
        );

        await initializeInvites(guild);
    });

    // 서버에서 봇이 제거됨
    client.on(Events.GuildDelete, guild => {
        inviteCache.delete(guild.id);
    });

    // ======================================
    // 초대 링크 생성
    // ======================================
    client.on(Events.InviteCreate, invite => {
        if (!invite.guild) return;

        const guildId = invite.guild.id;

        if (!guildConfig[guildId]) return;

        let cache = inviteCache.get(guildId);

        if (!cache) {
            cache = new Map();
            inviteCache.set(guildId, cache);
        }

        cache.set(invite.code, {
            uses: invite.uses ?? 0,
            inviterId: invite.inviterId ?? invite.inviter?.id ?? null
        });
    });

    // ======================================
    // 초대 링크 삭제
    // ======================================
    client.on(Events.InviteDelete, invite => {
        if (!invite.guild) return;

        const cache = inviteCache.get(invite.guild.id);

        cache?.delete(invite.code);
    });

    // ======================================
    // 멤버 입장
    // ======================================
    client.on(Events.GuildMemberAdd, async member => {
        try {
            const guild = member.guild;

            const channel = await getLogChannel(
                guild,
                "join"
            );

            if (!channel) return;

            let inviterText = "알 수 없음";

            // 초대 링크 사용 횟수 비교
            try {
                const oldInvites = inviteCache.get(guild.id);
                const newInvites = await fetchInvites(guild);

                if (oldInvites) {
                    const usedInvite = [...newInvites.entries()]
                        .find(([code, data]) =>
                            data.uses >
                            (oldInvites.get(code)?.uses ?? 0)
                        );

                    if (usedInvite) {
                        const inviterId = usedInvite[1].inviterId;

                        inviterText = inviterId
                            ? `<@${inviterId}>`
                            : "초대자 정보 없음";
                    }
                }

                inviteCache.set(guild.id, newInvites);

            } catch (error) {
                console.warn(
                    `[${guild.name}] 초대자 조회 실패:`,
                    error.message
                );
            }

            const bannerURL = await getUserBanner(
                member.user
            );

            // 입장 임베드
            const embed = new EmbedBuilder()
                .setColor(0xFFFFFF)
                .setTitle(
                    `${guild.memberCount}번째 멤버가 입장했어요`
                )
                .setThumbnail(
                    member.user.displayAvatarURL({
                        size: 256,
                        forceStatic: false
                    })
                )
                .addFields(
                    {
                        name: "유저",
                        value:
                            `<@${member.id}> (${member.user.username})`
                    },
                    {
                        name: "서버에 입장한 시간",
                        value: discordTime(
                            member.joinedAt || new Date()
                        )
                    },
                    {
                        name: "계정 생성일",
                        value: discordTime(
                            member.user.createdAt
                        )
                    },
                    {
                        name: "초대자",
                        value: inviterText
                    }
                )
                .setTimestamp();

            if (bannerURL) {
                embed.setImage(bannerURL);
            }

            await channel.send({
                embeds: [embed],
                allowedMentions: {
                    parse: []
                }
            });

            console.log(
                `[${guild.name}] 입장: ${member.user.username}`
            );

        } catch (error) {
            console.error(
                "입장 알림 오류:",
                error
            );
        }
    });

    // ======================================
    // 멤버 퇴장
    // ======================================
    client.on(Events.GuildMemberRemove, async member => {
        try {
            const guild = member.guild;

            const channel = await getLogChannel(
                guild,
                "leave"
            );

            if (!channel) return;

            const bannerURL = await getUserBanner(
                member.user
            );

            // 퇴장 임베드
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("멤버가 퇴장했어요")
                .setThumbnail(
                    member.user.displayAvatarURL({
                        size: 256,
                        forceStatic: false
                    })
                )
                .addFields(
                    {
                        name: "유저",
                        value:
                            `<@${member.id}> (${member.user.username})`
                    },
                    {
                        name: "서버에서 퇴장한 시간",
                        value: discordTime(new Date())
                    },
                    {
                        name: "계정 생성일",
                        value: discordTime(
                            member.user.createdAt
                        )
                    }
                )
                .setTimestamp();

            if (bannerURL) {
                embed.setImage(bannerURL);
            }

            await channel.send({
                embeds: [embed],
                allowedMentions: {
                    parse: []
                }
            });

            console.log(
                `[${guild.name}] 퇴장: ${member.user.username}`
            );

        } catch (error) {
            console.error(
                "퇴장 알림 오류:",
                error
            );
        }
    });
};
