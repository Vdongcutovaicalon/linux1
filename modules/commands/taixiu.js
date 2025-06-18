const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const diceImages = {
  1: "https://files.catbox.moe/w05g2j.jpeg",
  2: "https://files.catbox.moe/75gsam.jpeg",
  3: "https://files.catbox.moe/sxml3s.jpeg",
  4: "https://files.catbox.moe/yei3l9.jpeg",
  5: "https://files.catbox.moe/neawdq.jpeg",
  6: "https://files.catbox.moe/rvxe6s.jpeg"
};

const backgroundURL = "https://files.catbox.moe/589c1e.jpeg";

function parseBetAmount(input, userMoney) {
  if (!input || input.toLowerCase() === "all") return userMoney;

  const units = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, g: 1e15 };
  input = input.toLowerCase().replace(/,/g, "").trim();

  const unit = input.slice(-1);
  const number = parseFloat(unit in units ? input.slice(0, -1) : input);

  if (isNaN(number)) return NaN;
  return Math.floor(number * (units[unit] || 1));
}

async function drawDiceResult(results) {
  const canvas = createCanvas(600, 300);
  const ctx = canvas.getContext("2d");

  const bg = await loadImage(backgroundURL);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  const positions = [
    { x: 50, y: 70 },
    { x: 226, y: 70 },
    { x: 400, y: 70 }
  ];

  for (let i = 0; i < results.length; i++) {
    const img = await loadImage(diceImages[results[i]]);
    ctx.drawImage(img, positions[i].x, positions[i].y, 160, 160);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.arc(300, 150, 130, 0, Math.PI * 2);
  ctx.fill();

  const filePath = path.join(__dirname, "cache", `dice_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  await new Promise(resolve => out.on("finish", resolve));
  return filePath;
}

module.exports = {
  config: {
    name: "taixiu",
    version: "2.0",
    hasPermssion: 0,
    credits: "Refactor by DongDev",
    description: "Chơi tài xỉu cược tiền hỗ trợ k/m/b/t/g/all",
    commandCategory: "giải trí",
    usages: "[tài/xỉu] [số tiền]",
    cooldowns: 5
  },

  run: async function ({ api, event, args, Currencies }) {
    const { threadID, messageID, senderID } = event;
    const [side, rawBet] = args;

    if (!["tài", "xỉu"].includes(side?.toLowerCase()))
      return api.sendMessage("🔢 Vui lòng chọn: tài hoặc xỉu.", threadID, messageID);

    const { money } = await Currencies.getData(senderID);
    if (money <= 0) return api.sendMessage("⚠️ Bạn không có tiền để cược.", threadID, messageID);

    const bet = parseBetAmount(rawBet, money);
    if (isNaN(bet) || bet <= 0)
      return api.sendMessage("💰 Số tiền không hợp lệ. Nhập số cụ thể hoặc các đơn vị k, m, b, t, g, all.", threadID, messageID);

    if (bet > money)
      return api.sendMessage("⚠️ Bạn không đủ tiền để cược số tiền này.", threadID, messageID);

    await Currencies.decreaseMoney(senderID, bet);
    const loading = await api.sendMessage("🎲 Đang lắc xúc xắc...", threadID);
    setTimeout(() => api.unsendMessage(loading.messageID), 3000);
    await new Promise(res => setTimeout(res, 3000));

    const results = Array.from({ length: 3 }, () => Math.floor(Math.random() * 6 + 1));
    const total = results.reduce((a, b) => a + b);
    const outcome = total >= 11 ? "tài" : "xỉu";
    const win = outcome === side.toLowerCase();
    const reward = win ? bet * 2 : 0;

    if (win) await Currencies.increaseMoney(senderID, reward);

    const imagePath = await drawDiceResult(results);
    const msg = `🎲 Kết quả: ${results.join(" + ")} = ${total} → ${outcome.toUpperCase()}\n` +
                `📌 Bạn chọn: ${side.toUpperCase()} | Cược: ${bet.toLocaleString()}$\n` +
                (win
                  ? `🎉 Thắng! Nhận được ${reward.toLocaleString()}$`
                  : `😢 Thua! Mất ${bet.toLocaleString()}$`);

    return api.sendMessage({
      body: msg,
      attachment: fs.createReadStream(imagePath)
    }, threadID, () => fs.unlinkSync(imagePath), messageID);
  }
};
