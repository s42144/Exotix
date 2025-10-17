require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs-extra');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const DATA_FILE = './data.json';
let data = { buyers: [], pending: [] };

// Load existing data
if (fs.existsSync(DATA_FILE)) {
  data = fs.readJsonSync(DATA_FILE);
}

// Save data function
const saveData = () => fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });

// Helper: verify TON transaction via TONCENTER API
async function verifyTransaction(txHash) {
  try {
    const url = `https://toncenter.com/api/v2/getTransaction?hash=${txHash}&api_key=${process.env.TONCENTER_API_KEY}`;
    const response = await axios.get(url);
    if (response.data.ok) {
      return response.data.result;
    } else {
      return null;
    }
  } catch (err) {
    console.error('TX verification error:', err.message);
    return null;
  }
}

// /start command
bot.start((ctx) => {
  const msg = `
👋 Welcome to Shark Bounty Presale Bot!

💰 Token: SHB
💵 Price: 0.0005 TON per SHB
⚡ Minimum buy: 3 TON

Send your transaction hash after sending TON to the presale wallet.

📥 Presale Wallet:
${process.env.PRESALE_WALLET}

Type /help for instructions.
  `;
  ctx.reply(msg);
});

// /help command
bot.command('help', (ctx) => {
  const msg = `
📌 How to participate:

1️⃣ Send TON (>= 3 TON) to the presale wallet.
2️⃣ Copy the transaction hash.
3️⃣ Send the hash to this bot.
4️⃣ Admin will verify and approve your tokens.
  `;
  ctx.reply(msg);
});

// Handle user messages (assume TX hash)
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const txHash = ctx.message.text.trim();

  // Check if already pending or approved
  if (data.pending.find(t => t.txHash === txHash) || data.buyers.find(t => t.txHash === txHash)) {
    return ctx.reply('⚠️ This transaction hash is already submitted.');
  }

  const tx = await verifyTransaction(txHash);
  if (!tx) return ctx.reply('❌ Transaction not found or not confirmed yet. Try again later.');

  const amountTON = parseFloat(tx.inMsg.value) / 1e9; // TON to float
  if (amountTON < 3) return ctx.reply('❌ Amount is less than minimum 3 TON.');

  const tokenAmount = amountTON / 0.0005;

  data.pending.push({
    userId,
    username: ctx.from.username || ctx.from.first_name,
    txHash,
    tonSent: amountTON,
    tokenAmount,
    timestamp: Date.now()
  });
  saveData();

  ctx.reply(`✅ Your transaction is pending approval.\nTokens to receive: ${tokenAmount.toFixed(2)} SHB`);
});

// Admin commands
bot.command('approve', (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
  const parts = ctx.message.text.split(' ');
  const txHash = parts[1];
  const txIndex = data.pending.findIndex(t => t.txHash === txHash);
  if (txIndex === -1) return ctx.reply('❌ Pending TX not found.');

  const tx = data.pending.splice(txIndex, 1)[0];
  data.buyers.push(tx);
  saveData();

  ctx.reply(`✅ Transaction approved: ${txHash}`);
  bot.telegram.sendMessage(tx.userId, `🎉 Your transaction has been approved!\nYou will receive ${tx.tokenAmount.toFixed(2)} SHB manually.`);
});

bot.command('reject', (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
  const parts = ctx.message.text.split(' ');
  const txHash = parts[1];
  const txIndex = data.pending.findIndex(t => t.txHash === txHash);
  if (txIndex === -1) return ctx.reply('❌ Pending TX not found.');

  const tx = data.pending.splice(txIndex, 1)[0];
  saveData();

  ctx.reply(`❌ Transaction rejected: ${txHash}`);
  bot.telegram.sendMessage(tx.userId, `❌ Your transaction has been rejected. Please check your payment.`);
});

bot.command('stats', (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
  const totalTON = data.buyers.reduce((sum, t) => sum + t.tonSent, 0);
  const totalBuyers = data.buyers.length;
  const totalPending = data.pending.length;
  ctx.reply(`📊 Stats:\nTotal TON received: ${totalTON.toFixed(2)}\nTotal buyers: ${totalBuyers}\nPending transactions: ${totalPending}`);
});

bot.command('pending', (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
  if (data.pending.length === 0) return ctx.reply('✅ No pending transactions.');
  let msg = '🕒 Pending Transactions:\n';
  data.pending.forEach(t => {
    msg += `\nTX: ${t.txHash}\nUser: ${t.username}\nTON: ${t.tonSent}\nTokens: ${t.tokenAmount.toFixed(2)}\n`;
  });
  ctx.reply(msg);
});

bot.command('buyers', (ctx) => {
  if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
  if (data.buyers.length === 0) return ctx.reply('No approved buyers yet.');
  let msg = '✅ Approved Buyers:\n';
  data.buyers.forEach(t => {
    msg += `\nUser: ${t.username}\nTokens: ${t.tokenAmount.toFixed(2)}\nTX: ${t.txHash}\n`;
  });
  ctx.reply(msg);
});

// Start bot
bot.launch();
console.log('🤖 Manual Presale Bot running...');
