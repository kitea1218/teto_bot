// ==========================================
// 필요한 라이브러리
// ==========================================
const {
    Client,
    Events,
    GatewayIntentBits
} = require("discord.js");

require("dotenv").config();

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
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// 로그인 완료
// ==========================================
client.once(Events.ClientReady, () => {
    console.log(`✅ 로그인 완료 : ${client.user.tag}`);
});

// ==========================================
// RoVer API에서 Roblox 닉네임 가져오기
// ==========================================
async function getRobloxUsername(discordId) {
    try {
        const response = await axios.get(
            `https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`,
            {
                headers: {
                    Authorization: `Bearer ${roverApiKey}`
                }
            }
        );

        console.log("RoVer API 응답:", response.data);

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
// Verified 역할이 추가되면 실행
// ==========================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {

    console.log("GuildMemberUpdate 실행");

    const hadVerified = oldMember.roles.cache.has(VERIFIED_ROLE_ID);
    const hasVerified = newMember.roles.cache.has(VERIFIED_ROLE_ID);

    console.log("이전 Verified:", hadVerified);
    console.log("현재 Verified:", hasVerified);

    // Verified 역할이 새로 추가된 경우에만 실행
    if (hadVerified || !hasVerified) return;

    console.log(`${newMember.user.tag} 인증 완료`);

    const robloxName = await getRobloxUsername(newMember.id);

    if (!robloxName) return;

    // ==========================================
    // 기존 [Roblox닉] 제거 및 이름 획득
    // ==========================================
    // 1. 서버 닉네임 -> 글로벌 닉네임(테스트용) -> 유저네임(wn...) 순서로 가져오기
    const currentName = newMember.user.displayName;

    // 2. 이름 뒤에 붙어있을 수 있는 기존 대괄호 제거
    const baseName = currentName.replace(/\s*\[[^\]]+\]$/, "");

    // 3. 새 닉네임 생성
    const nickname = `${baseName} [${robloxName}]`;

    // 4. 이미 원하는 닉네임과 똑같다면 변경 취소
    if (currentName === nickname) return;

    try {

        await newMember.setNickname(nickname);

        console.log(`닉네임 변경 완료 → ${nickname}`);

    } catch (err) {

        console.error("닉네임 변경 실패");
        console.error(err);

    }

});

// ==========================================
// 봇 로그인
// ==========================================
console.log("token =", token);
console.log("type =", typeof token);

client.login(token);