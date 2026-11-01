const { EmbedBuilder, Events } = require('discord.js');

// .env에 설정한 입퇴장 알림 채널 ID
const LOG_CHANNEL_ID = process.env.JOIN_LEAVE_CHANNEL_ID;

// 서버별 초대 링크 정보 저장
const inviteCache = new Map();

// 디스코드 시간 표시
function discordTime(date) {
  if (!date) return '알 수 없음';

  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:F> (<t:${unix}:R>)`;
}

// 로그 채널 가져오기
async function getLogChannel(guild) {
  if (!LOG_CHANNEL_ID) return null;

  const channel = await guild.channels
    .fetch(LOG_CHANNEL_ID)
    .catch(() => null);

  return channel?.isTextBased() &&
    typeof channel.send === 'function'
    ? channel
    : null;
}

// 사용자 프로필 배너 가져오기 (GIF 지원)
async function getUserBanner(user) {
  try {
    const fetchedUser = await user.fetch(true);

    return fetchedUser.bannerURL({
      size: 1024,
      forceStatic: false
    });
  } catch (error) {
    console.warn('배너 조회 실패:', error.message);
    return null;
  }
}

// 서버의 초대 링크 목록 가져오기
async function fetchInvites(guild) {
  const invites = await guild.invites.fetch();

  return new Map(
    invites.map(invite => [
      invite.code,
      {
        uses: invite.uses ?? 0,
        inviterId: invite.inviterId
      }
    ])
  );
}

module.exports = function setupJoinLeave(client) {

  // 봇 시작 시 초대 링크 정보 저장
  client.once(Events.ClientReady, async () => {
    if (!LOG_CHANNEL_ID) {
      console.warn(
        '⚠️ JOIN_LEAVE_CHANNEL_ID가 설정되지 않았습니다.'
      );
    }

    for (const guild of client.guilds.cache.values()) {
      try {
        const invites = await fetchInvites(guild);
        inviteCache.set(guild.id, invites);
      } catch (error) {
        console.warn(
          `[초대 링크 조회 실패] ${guild.name}:`,
          error.message
        );
      }
    }

    console.log('✅ 입퇴장 알림 기능 활성화');
  });

  // 초대 링크 생성 시 캐시 업데이트
  client.on(Events.InviteCreate, invite => {
    if (!invite.guild) return;

    const cache = inviteCache.get(invite.guild.id);
    if (!cache) return;

    cache.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviterId
    });
  });

  // 초대 링크 삭제 시 캐시 제거
  client.on(Events.InviteDelete, invite => {
    if (!invite.guild) return;

    const cache = inviteCache.get(invite.guild.id);
    cache?.delete(invite.code);
  });

  // ==========================
  // 멤버 입장
  // ==========================

  client.on(Events.GuildMemberAdd, async member => {
    try {
      const guild = member.guild;
      const channel = await getLogChannel(guild);

      if (!channel) return;

      let inviterText = '알 수 없음';

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
              : '초대자 정보 없음';
          }
        }

        inviteCache.set(guild.id, newInvites);
      } catch (error) {
        console.warn(
          '초대자 조회 실패:',
          error.message
        );
      }

      // 사용자 배너 가져오기
      const bannerURL = await getUserBanner(member.user);

      // 입장 임베드 생성
      const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setTitle(
          `✦${guild.memberCount}번째 멤버가 입장했어요✦`
        )
        .setThumbnail(
          member.user.displayAvatarURL({
            size: 256,
            forceStatic: false
          })
        )
        .addFields(
          {
            name: '유저',
            value:
              `<@${member.id}> (${member.user.username})`
          },
          {
            name: '서버에 입장한 시간',
            value: discordTime(
              member.joinedAt || new Date()
            )
          },
          {
            name: '계정 생성일',
            value: discordTime(
              member.user.createdAt
            )
          },
          {
            name: '초대자',
            value: inviterText
          }
        )
        .setTimestamp();

      // 배너가 있다면 하단 이미지로 표시
      if (bannerURL) {
        embed.setImage(bannerURL);
      }

      // 알림 전송
      await channel.send({
        embeds: [embed],
        allowedMentions: {
          users: [member.id]
        }
      });

      console.log(
        `[입장] ${member.user.username} (${member.id})`
      );

    } catch (error) {
      console.error('입장 알림 오류:', error);
    }
  });

  // ==========================
  // 멤버 퇴장
  // ==========================

  client.on(Events.GuildMemberRemove, async member => {
    try {
      const channel = await getLogChannel(member.guild);

      if (!channel) return;

      const bannerURL = await getUserBanner(member.user);

      // 퇴장 임베드 생성
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('멤버가 퇴장했어요')
        .setThumbnail(
          member.user.displayAvatarURL({
            size: 256,
            forceStatic: false
          })
        )
        .addFields(
          {
            name: '유저',
            value:
              `<@${member.id}> (${member.user.username})`
          },
          {
            name: '서버에서 퇴장한 시간',
            value: discordTime(new Date())
          },
          {
            name: '계정 생성일',
            value: discordTime(
              member.user.createdAt
            )
          }
        )
        .setTimestamp();

      // 배너가 있다면 하단 이미지로 표시
      if (bannerURL) {
        embed.setImage(bannerURL);
      }

      // 퇴장 알림 전송
      await channel.send({
        embeds: [embed],
        allowedMentions: {
          parse: []
        }
      });

      console.log(
        `[퇴장] ${member.user.username} (${member.id})`
      );

    } catch (error) {
      console.error('퇴장 알림 오류:', error);
    }
  });
};
