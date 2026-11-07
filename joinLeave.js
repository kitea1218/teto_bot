
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
// 서버별 알림 채널
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

    if (
        !channel?.isTextBased() ||
        typeof channel.send !== "function"
    ) {
        console.warn(
            `[${guild.name}] 알림 채널 접근 불가: ${channelId}`
        );
        return null;
    }

    return channel;
}

// ==========================================
// 사용자 배너 가져오기
// GIF 지원
// ==========================================
async function getUserBanner(user) {
    try {
        const fetchedUser = await user.fetch(true);

        return fetchedUser.bannerURL({
            size: 1024,
            forceStatic: false
        });

    } catch (error) {
        console.warn(
            "배너 조회 실패:",
            error.message
        );

        return null;
    }
}

// ==========================================
// 서버 초대 링크 정보 조회
// ==========================================
async function fetchInvites(guild) {
    const invites = await guild.invites.fetch();

    return new Map(
        invites.map(invite => [
            invite.code,
            {
                uses: invite.uses ?? 0,
                inviterId:
                    invite.inviterId ??
                    invite.inviter?.id ??
                    null
            }
        ])
    );
}

// ==========================================
// 초대 링크 캐시 초기화
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
        inviteCache.delete(guild.id);

        console.warn(
            `[${guild.name}] 초대 링크 조회 실패:`,
            error.message
        );
    }
}

// ==========================================
// 멀티 서버 입퇴장 기능
// ==========================================
module.exports = function setupJoinLeave(client) {

    // ======================================
    // 봇 시작
    // ======================================
    client.once(Events.ClientReady, async () => {
        console.log("✅ 입퇴장 알림 기능 활성화");

        for (const guild of client.guilds.cache.values()) {
            const settings = guildConfig[guild.id];

            if (!settings) {
                console.log(
                    `[${guild.name}] 설정되지 않은 서버`
                );
                continue;
            }

            console.log("--------------------------------");
            console.log(`[${guild.name}] 알림 설정`);
            console.log(
                "입장 채널:",
                settings.joinChannelId
            );
            console.log(
                "퇴장 채널:",
                settings.leaveChannelId
            );

            await initializeInvites(guild);
        }
    });

    // ======================================
    // 새로운 서버 추가
    // ======================================
    client.on(Events.GuildCreate, async guild => {
        console.log(
            `[새 서버] ${guild.name} (${guild.id})`
        );

        await initializeInvites(guild);
    });

    // ======================================
    // 서버 제거
    // ======================================
    client.on(Events.GuildDelete, guild => {
        inviteCache.delete(guild.id);
    });

    // ======================================
    // 초대 링크 생성
    // ======================================
    client.on(Events.InviteCreate, invite => {
        if (!invite.guild) return;
        if (!guildConfig[invite.guild.id]) return;

        // 초기 캐시가 없는 경우에는 비교할
        // 기준이 없으므로 여기서 만들지 않음
        const cache = inviteCache.get(invite.guild.id);

        if (!cache) return;

        cache.set(invite.code, {
            uses: invite.uses ?? 0,
            inviterId:
                invite.inviterId ??
                invite.inviter?.id ??
                null
        });
    });

    // ======================================
    // 초대 링크 삭제
    // ======================================
    client.on(Events.InviteDelete, invite => {
        if (!invite.guild) return;

        inviteCache.get(invite.guild.id)
            ?.delete(invite.code);
    });

    // ======================================
    // 멤버 입장
    // ======================================
    client.on(Events.GuildMemberAdd, async member => {
        const guild = member.guild;

        try {
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
                    const usedInvites = [
                        ...newInvites.entries()
                    ].filter(([code, data]) => {
                        const previous = oldInvites.get(code);

                        return previous &&
                            data.uses > previous.uses;
                    });

                    // 하나만 증가했을 경우 표시
                    if (usedInvites.length === 1) {
                        const inviterId =
                            usedInvites[0][1].inviterId;

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

            // 배너 GIF / 이미지
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
                `[${guild.name}] ✅ 입장: ${member.user.tag}`
            );

        } catch (error) {
            console.error(
                `[${guild.name}] 입장 알림 오류:`,
                error
            );
        }
    });

    // ======================================
    // 멤버 퇴장
    // ======================================
    client.on(Events.GuildMemberRemove, async member => {
        const guild = member.guild;

        try {
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
                `[${guild.name}] ✅ 퇴장: ${member.user.tag}`
            );

        } catch (error) {
            console.error(
                `[${guild.name}] 퇴장 알림 오류:`,
                error
            );
        }
    });
};
