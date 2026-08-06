const { Client, GatewayIntentBits } = require('discord.js');

// Botのインスタンスを作成（必要なIntentを設定）
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // メッセージ内容の取得に必要な権限
  ],
});

// 起動時の処理
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// メッセージを受信したときの処理
client.on('messageCreate', (message) => {
  // Bot自身の発言には反応しない
  if (message.author.bot) return;

  // 「ping」と送信されたら「pong」と返す
  if (message.content === 'ping') {
    message.reply('pong');
  }
});

// Renderの環境変数（DISCORD_TOKEN）を使ってログイン
client.login(process.env.DISCORD_TOKEN);
