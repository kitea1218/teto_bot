
const {
    Client,
    Events,
    GatewayIntentBits
} = require("discord.js");

const axios = require("axios");
const guildConfig = require("./guildConfig.json");

require("dotenv").config();

// ==========================================
// 환경 변수
// ==========================================
const token = process.env.DISCORD_TOKEN;

// ==========================================
// 디스코드 봇 생성
// ==========================================
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
    console.log("================================");
    console.log(`✅ 로그인 완료 : ${client.user.tag}`);
    console.log(`✅ 연결된 서버 수 : ${client.guilds.cache.size}`);

    for (const guild of client.guilds.cache.values()) {
        const settings = guildConfig[guild.id];

        console.log("--------------------------------");
        console.log(`서버: ${guild.name}`);
        console.log(`서버 ID: ${guild.id}`);

        if (!settings) {
            console.warn("⚠️ 서버 설정 없음");
            continue;
        }

        console.log(
            "인증 역할:",
            settings.verifiedRoleId || "없음"
        );

        const apiKey = process.env[settings.roverApiKeyEnv];

        console.log(
            "RoVer API:",
            apiKey ? "OK" : "없음"
        );
    }

    console.log("================================");
});

// ==========================================
// 서버별 RoVer API
// ==========================================
async function getRobloxUsername(guildId, discordId) {
    const settings = guildConfig[guildId];

    if (!settings) {
        console.warn(`[${guildId}] 서버 설정 없음`);
        return null;
    }

    const apiKeyEnv = settings.roverApiKeyEnv;
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
        console.error(
            `[${guildId}] RoVer API 키가 설정되지 않았습니다.`
        );
        return null;
    }

    console.log(
        `[${guildId}] RoVer API 요청: ${discordId}`
    );

    try {
        const response = await axios.get(
            `https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                },
                timeout: 10000
            }
        );

        const data = response.data;

        console.log(
            `[${guildId}] RoVer 조회 성공`
        );

        if (!data?.cachedUsername) {
            console.warn(
                `[${guildId}] Roblox 이름이 없습니다.`
            );
            return null;
        }

        return data.cachedUsername;

    } catch (error) {
        console.error(
            `[${guildId}] RoVer API 오류`
        );

        if (error.response) {
            console.error(
                "상태 코드:",
                error.response.status
            );

            console.error(
                "응답:",
                error.response.data
            );
        } else {
            console.error(error.message);
        }

        return null;
    }
}

// ==========================================
// RoVer 인증 감지
// ==========================================
client.on(
    Events.GuildMemberUpdate,
    async (oldMember, newMember) => {
        const guild = newMember.guild;
        const guildId = guild.id;

        const settings = guildConfig[guildId];

        if (!settings?.verifiedRoleId) return;

        const verifiedRoleId = settings.verifiedRoleId;

        const hadVerified =
            oldMember.roles.cache.has(verifiedRoleId);

        const hasVerified =
            newMember.roles.cache.has(verifiedRoleId);

        // Verified 역할이 새로 추가된 경우만 실행
        if (hadVerified || !hasVerified) return;

        console.log("================================");
        console.log(`[${guild.name}] RoVer 인증 감지`);
        console.log("유저:", newMember.user.tag);

        const robloxName = await getRobloxUsername(
            guildId,
            newMember.id
        );

        if (!robloxName) {
            console.warn(
                `[${guild.name}] Roblox 이름 조회 실패`
            );
            return;
        }

        // 기존 [RobloxName] 제거
        const currentName = newMember.displayName;

        const baseName = currentName
            .replace(/\s*\[[^\]]+\]$/, "");

        const nickname = `${baseName} [${robloxName}]`;

        console.log("현재 닉네임:", currentName);
        console.log("변경할 닉네임:", nickname);

        if (currentName === nickname) {
            console.log("이미 동일한 닉네임");
            return;
        }

        // 디스코드 닉네임 32자 제한
        if (nickname.length > 32) {
            console.warn(
                `[${guild.name}] 닉네임이 32자를 초과합니다.`
            );
            return;
        }

        try {
            await newMember.setNickname(nickname);

            console.log(
                `[${guild.name}] ✅ 닉네임 변경 성공`
            );

        } catch (error) {
            console.error(
                `[${guild.name}] 닉네임 변경 실패:`,
                error.message
            );
        }
    }
);

// ==========================================
// 테토 연속 입력 상태
// 서버·채널별 독립 관리
// ==========================================
const tetoStates = new Map();

// ==========================================
// 채팅 자동 응답
// ==========================================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const text = message.content.trim().toLowerCase();

    const key =
        `${message.guild.id}:${message.channel.id}`;

    const state = tetoStates.get(key) || {
        currentUser: null,
        count: 0
    };

    // ==========================
    // 테토
    // ==========================
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
                Math.floor(
                    Math.random() * specialMessages.length
                )
            ];

            tetoStates.delete(key);

            await message.reply(random);

        } else {
            tetoStates.set(key, state);

            await message.reply("테토!");
        }

        return;
    }

    // ==========================
    // 태토
    // ==========================
    if (text === "태토") {
        tetoStates.delete(key);

        await message.reply("태토?");
        return;
    }

    // ==========================
    // 다른 메시지가 오면 초기화
    // ==========================
    tetoStates.delete(key);
});

// ==========================================
// 입퇴장 알림 기능
// ==========================================
const setupJoinLeave = require("./joinLeave");

setupJoinLeave(client);

// ==========================================
// 로그인 전 설정 확인
// ==========================================
console.log("================================");
console.log("테토봇 시작");
console.log("Discord Token:", token ? "OK" : "없음");

for (const [guildId, settings] of Object.entries(guildConfig)) {
    const apiKey = process.env[settings.roverApiKeyEnv];

    console.log(
        `[${guildId}] RoVer API:`,
        apiKey ? "OK" : "없음"
    );
}

console.log("================================");

// ==========================================
// 로그인
// ==========================================
if (!token) {
    console.error("❌ DISCORD_TOKEN이 없습니다.");
    process.exit(1);
}

client.login(token).catch(error => {
    console.error("❌ 디스코드 로그인 실패:", error);
    process.exit(1);
});
