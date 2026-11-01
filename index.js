// ==========================================
// 필요한 라이브러리
// ==========================================
const {
    Client,
    Events,
    GatewayIntentBits
} = require("discord.js");

const axios = require("axios");
require("dotenv").config();

// ==========================================
// 환경 변수
// ==========================================
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const roverApiKey = process.env.ROVER_API_KEY;

// RoVer Verified 역할 ID
const VERIFIED_ROLE_ID = "1528618176739414089";

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
    console.log(`✅ 로그인 완료 : ${client.user.tag}`);
});

// ==========================================
// 이벤트가 오는지 확인용
// ==========================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {

    console.log("================================");
    console.log("GuildMemberUpdate 실행");
    console.log("유저:", newMember.user.tag);

    const hadVerified = oldMember.roles.cache.has(VERIFIED_ROLE_ID);
    const hasVerified = newMember.roles.cache.has(VERIFIED_ROLE_ID);

    console.log("이전 Verified:", hadVerified);
    console.log("현재 Verified:", hasVerified);

    if (hadVerified || !hasVerified) {
        console.log("Verified 역할 추가 이벤트가 아님");
        return;
    }

    console.log("RoVer 인증 감지");

    const robloxName = await getRobloxUsername(newMember.id);

    if (!robloxName) {
        console.log("Roblox 이름을 가져오지 못함");
        return;
    }

    const currentName = newMember.displayName;
    const baseName = currentName.replace(/\s*\[[^\]]+\]$/, "");
    const nickname = `${baseName} [${robloxName}]`;

    console.log("현재 닉네임:", currentName);
    console.log("변경할 닉네임:", nickname);

    if (currentName === nickname) {
        console.log("이미 동일한 닉네임");
        return;
    }

    try {
        await newMember.setNickname(nickname);
        console.log("닉네임 변경 성공");
    } catch (err) {
        console.error("닉네임 변경 실패");
        console.error(err);
    }

});

// ==========================================
// RoVer API
// ==========================================
async function getRobloxUsername(discordId) {

    console.log("RoVer API 요청:", discordId);

    try {

        const response = await axios.get(
    `https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`,
    {
        headers: {
            Authorization: `Bearer ${roverApiKey}`
        }
    }
);

        console.log("RoVer 응답:", response.data);

        return response.data.cachedUsername;

    } catch (err) {

        console.error("RoVer API 오류");

        if (err.response) {
            console.error(err.response.status);
            console.error(err.response.data);
        } else {
            console.error(err.message);
        }

        return null;
    }
}

// ==========================================
<<<<<<< HEAD
// 현재 테토 연속 사용자
// ==========================================
let currentUser = null;
let tetoCount = 0;

// ==========================================
// 채팅 답장
// ==========================================
client.on(Events.MessageCreate, async (message) => {

    if (message.author.bot) return;

    const text = message.content.trim().toLowerCase();

    // ==========================
    // 테토
    // ==========================
    if (text === "테토") {

        // 처음 시작
        if (currentUser === null) {
            currentUser = message.author.id;
            tetoCount = 1;
        }
        // 같은 사람이 계속 입력
        else if (currentUser === message.author.id) {
            tetoCount++;
        }
        // 다른 사람이 테토 입력 → 이전 사람 초기화 후 새로 시작
        else {
            currentUser = message.author.id;
            tetoCount = 1;
        }

        if (tetoCount >= 3) {

            const specialMessages = [
                "테토테토테토!",
                "Teto!",
                "테토다요!",
                "테토리스!",
                "테토x3"
            ];

            const random =
                specialMessages[Math.floor(Math.random() * specialMessages.length)];

            await message.reply(random);

            // 초기화
            currentUser = null;
            tetoCount = 0;

        } else {

            await message.reply("테토!");

        }

        return;
    }

    // ==========================
    // 태토
    // ==========================
    if (text === "태토") {
        currentUser = null;
        tetoCount = 0;

        await message.reply("태토?");
        return;
    }

    // ==========================
    // 다른 사람이 아무 말이나 하면 초기화
    // ==========================
    currentUser = null;
    tetoCount = 0;

});
// ==========================================
=======
// 입퇴장 알림 기능
// ==========================================
const setupJoinLeave = require("./joinLeave");
setupJoinLeave(client);

// ==========================================
>>>>>>> 952465d (입퇴장 시스템 추가)
// 로그인
// ==========================================
console.log("Token:", token ? "OK" : "없음");
console.log("Guild:", guildId);
console.log("RoVer:", roverApiKey ? "OK" : "없음");

client.login(token);
