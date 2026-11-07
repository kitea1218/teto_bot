
const {
    Client,
    Events,
    GatewayIntentBits
} = require("discord.js");

const axios = require("axios");
const guildConfig = require("./guildConfig.json");
require("dotenv").config();

const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites
    ]
});

// ==========================================
// 로그인 완료
// ==========================================
client.once(Events.ClientReady, () => {
    console.log(`✅ 로그인 완료 : ${client.user.tag}`);
    console.log(`서버 수: ${client.guilds.cache.size}`);

    for (const guild of client.guilds.cache.values()) {
        console.log(`- ${guild.name} (${guild.id})`);
    }
});

// ==========================================
// RoVer 인증 후 닉네임 변경
// ==========================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const guildId = newMember.guild.id;
    const settings = guildConfig[guildId];

    if (!settings?.verifiedRoleId) return;

    const verifiedRoleId = settings.verifiedRoleId;

    const hadVerified = oldMember.roles.cache.has(verifiedRoleId);
    const hasVerified = newMember.roles.cache.has(verifiedRoleId);

    if (hadVerified || !hasVerified) return;

    console.log(`[${newMember.guild.name}] RoVer 인증 감지: ${newMember.user.tag}`);

    const robloxName = await getRobloxUsername(
        guildId,
        newMember.id
    );

    if (!robloxName) return;

    const currentName = newMember.displayName;
    const baseName = currentName.replace(/\s*\[[^\]]+\]$/, "");
    const nickname = `${baseName} [${robloxName}]`;

    if (currentName === nickname) return;

    try {
        await newMember.setNickname(nickname);
        console.log(`[${newMember.guild.name}] 닉네임 변경 성공: ${nickname}`);
    } catch (err) {
        console.error(`[${newMember.guild.name}] 닉네임 변경 실패:`, err);
    }
});

// ==========================================
// RoVer API
// ==========================================
async function getRobloxUsername(guildId, discordId) {
    try {
        const response = await axios.get(
            `https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`,
            {
                headers: {
                    Authorization: `Bearer ${roverApiKey}`
                },
                timeout: 10000
            }
        );

        return response.data.cachedUsername || null;

    } catch (err) {
        console.error(
            `RoVer API 오류 (${guildId}):`,
            err.response?.status,
            err.response?.data || err.message
        );
        return null;
    }
}

// ==========================================
// 서버·채널별 테토 상태
// ==========================================
const tetoStates = new Map();

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const text = message.content.trim().toLowerCase();
    const key = `${message.guild.id}:${message.channel.id}`;

    let state = tetoStates.get(key) || {
        currentUser: null,
        count: 0
    };

    if (text === "테토") {
        if (state.currentUser === message.author.id) {
            state.count++;
        } else {
            state.currentUser = message.author.id;
            state.count = 1;
        }

        if (state.count >= 3) {
            const specialMessages = [
                "테토테토테토!",
                "Teto!",
                "테토다요!",
                "테토리스!",
                "테토x3"
            ];

            const random = specialMessages[
                Math.floor(Math.random() * specialMessages.length)
            ];

            tetoStates.delete(key);
            await message.reply(random);
        } else {
            tetoStates.set(key, state);
            await message.reply("테토!");
        }

        return;
    }

    if (text === "태토") {
        tetoStates.delete(key);
        await message.reply("태토?");
        return;
    }

    tetoStates.delete(key);
});

// ==========================================
// 입퇴장 알림
// ==========================================
const setupJoinLeave = require("./joinLeave");
setupJoinLeave(client);

// ==========================================
// 로그인
// ==========================================
console.log("Token:", token ? "OK" : "없음");
console.log("RoVer:", roverApiKey ? "OK" : "없음");

client.login(token);
