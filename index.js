const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = createAudioPlayer();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 「!join」でBotをボイスチャンネルに呼ぶ
  if (message.content === '!join') {
    if (message.member.voice.channel) {
      joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      }).subscribe(player);
      return message.reply('ボイスチャンネルに入りました！');
    } else {
      return message.reply('先にボイスチャンネルに入ってください！');
    }
  }

  // 「!leave」でBotを退出させる
  if (message.content === '!leave') {
    const connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    connection.destroy();
    return message.reply('退出しました！');
  }

  // 読み上げ処理（コマンド以外のテキスト）
  if (message.guild.members.me.voice.channel) {
    const text = message.content;
    const filePath = path.join(__dirname, 'temp.mp3');
    const gtts = new gTTS(text, 'ja');

    gtts.save(filePath, (err) => {
      if (err) return console.error(err);
      const resource = createAudioResource(filePath);
      player.play(resource);
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
