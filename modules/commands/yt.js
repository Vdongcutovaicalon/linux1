const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "yt",
    version: "1.0.0",
    hasPermission: 0,
    credits: "NgTuann x ChatGPT",
    description: "Tìm kiếm và tải nhạc/video từ YouTube",
    commandCategory: "Tiện ích",
    usages: "[từ khóa]",
    cooldowns: 5
  },

  run: async ({ api, event, args }) => {
    const keyword = args.join(" ");
    if (!keyword) return api.sendMessage("Vui lòng nhập từ khóa tìm kiếm.", event.threadID, event.messageID);

    const res = await ytSearch(keyword);
    const video = res.videos[0];
    if (!video) return api.sendMessage("Không tìm thấy video nào!", event.threadID, event.messageID);

    const msg = `✅ Đã tìm thấy video:\n\n📌 Tiêu đề: ${video.title}\n⏱ Thời lượng: ${video.timestamp}\n📎 Link: ${video.url}\n\nReply 'mp3' hoặc 'mp4' để tải.`;

    api.sendMessage({
      body: msg,
      attachment: await global.utils.getStreamFromURL(video.thumbnail)
    }, event.threadID, (err, info) => {
      global.client.handleReply.push({
        name: this.config.name,
        messageID: info.messageID,
        video
      });
    }, event.messageID);
  },

  handleReply: async ({ api, event, handleReply }) => {
    const { video } = handleReply;
    const reply = event.body.toLowerCase();

    if (!['mp3', 'mp4'].includes(reply)) return api.sendMessage("Vui lòng chỉ chọn 'mp3' hoặc 'mp4'.", event.threadID, event.messageID);

    const ext = reply === 'mp3' ? 'mp3' : 'mp4';
    const fileName = path.join(__dirname, `tmp_${event.senderID}.${ext}`);

    const stream = ytdl(video.url, {
      filter: reply === 'mp3' ? 'audioonly' : 'videoandaudio',
      quality: 'highest'
    });

    const file = fs.createWriteStream(fileName);
    stream.pipe(file);

    file.on('finish', () => {
      api.sendMessage({
        body: `✅ Đây là file ${ext.toUpperCase()} bạn yêu cầu:`,
        attachment: fs.createReadStream(fileName)
      }, event.threadID, () => fs.unlinkSync(fileName));
    });

    file.on('error', () => {
      api.sendMessage("❌ Lỗi trong quá trình tải.", event.threadID);
    });
  }
};