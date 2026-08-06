const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
} = require('@discordjs/voice');
const gTTS = require('gtts');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const player = createAudioPlayer();

let connection = null;
let targetTextChannel = null;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 1. !join コマンドでBotをVCに参加させる
  if (message.content === '!join') {
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      return message.reply('先にVCに参加してください！');
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false, // ユーザーの音声を聞くために偽ミュートを解除
    });

    connection.subscribe(player);
    targetTextChannel = message.channel;
    message.reply('VCに参加しました！読み上げと文字起こしを開始します。');

    // VC内での発言（音声）を監視して文字起こしする処理
    const receiver = connection.receiver;
    receiver.speaking.on('start', (userId) => {
      listenAndTranscribe(receiver, userId);
    });
    return;
  }

  // 2. !leave コマンドでBotをVCから退出させる
  if (message.content === '!leave') {
    if (connection) {
      connection.destroy();
      connection = null;
      targetTextChannel = null;
      message.reply('VCから退出しました。');
    }
    return;
  }

  // 3. BotがVCにいる間、テキストチャットを音声で読み上げる
  if (connection && targetTextChannel && message.channel.id === targetTextChannel.id) {
    if (message.content.startsWith('!')) return; // コマンドは読み上げない

    const textToRead = `${message.member?.displayName || message.author.username}：${message.content}`;
    const filePath = path.join(__dirname, 'temp_tts.mp3');

    const gtts = new gTTS(textToRead, 'ja');
    gtts.save(filePath, (err) => {
      if (err) return console.error('TTS Error:', err);
      const resource = createAudioResource(filePath);
      player.play(resource);
    });
  }
});

// 音声を録音して Whisper API で文字起こしする関数
async function listenAndTranscribe(receiver, userId) {
  const user = await client.users.fetch(userId).catch(() => null);
  const username = user ? user.username : 'Unknown';

  const opusStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1000, // 1秒間無音だったら発言終了とみなす
    },
  });

  const pcmStream = opusStream.pipe(
    new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 })
  );

  const filename = `./temp_${userId}_${Date.now()}.pcm`;
  const out = fs.createWriteStream(filename);

  pcmStream.pipe(out);

  out.on('finish', async () => {
    try {
      // PCMファイルをWAV形式等に変換せずにWhisper APIへ直接送信
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filename),
        model: 'whisper-1',
        language: 'ja',
      });

      const text = response.text.trim();
      if (text && targetTextChannel) {
        // テキストチャンネルへ「[ユーザー名] メッセージ」形式で送信
        targetTextChannel.send(`**[${username}]** ${text}`);
      }
    } catch (error) {
      console.error('文字起こしエラー:', error);
    } finally {
      // 一時ファイルの削除
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
    }
  });
}

client.login(process.env.DISCORD_TOKEN);
