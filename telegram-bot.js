require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Retrieve the token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error("FATAL ERROR: TELEGRAM_BOT_TOKEN is not defined in the environment.");
    console.error("Please create a .env.local or .env file with your Telegram Bot Token");
    process.exit(1);
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

console.log("PredictionDive Telegram Bot started. Listening for alerts...");

// Map to store user subscriptions: chatId -> Set of slugs
const userSubscriptions = new Map();

const mainMenuOpts = {
    reply_markup: {
        keyboard: [
            [{ text: "Markets" }, { text: "Tracked Markets" }],
            [{ text: "Information" }]
        ],
        resize_keyboard: true
    },
    parse_mode: "HTML"
};

// Matches "/start [slug]"
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const slug = match[1];

    if (slug) {
        // User clicked the SET_ALERT button on a specific market
        if (!userSubscriptions.has(chatId)) {
            userSubscriptions.set(chatId, new Set());
        }
        userSubscriptions.get(chatId).add(slug);

        const title = escapeHTML(await getMarketTitle(slug));

        bot.sendMessage(chatId, `✅ <b>Alert Set Successfully!</b>\n\nYou are now tracking: <i>${title}</i>.\n\nI will monitor SynthData ML models and notify you if the fair probability diverges significantly from the Polymarket odds or if the liquidation risk exceeds 5%.`, Object.assign({}, mainMenuOpts));
    } else {
        // Standard start message
        bot.sendMessage(chatId, "👋 <b>Welcome!</b> Use the menu below to navigate.", Object.assign({}, mainMenuOpts));
    }
});

// Helper function to fetch the real market title from Polymarket
async function getMarketTitle(slug) {
    try {
        const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
        const data = await res.json();
        if (data && data.length > 0 && data[0].title) {
            return data[0].title;
        }
    } catch (e) {
        console.error("Failed to fetch market title:", e);
    }
    return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

bot.onText(/Information/, (msg) => {
    const infoText = `👋 Welcome to the PreSynth Bot!\n\nWe provide the ability to compare and track divergences in odds between Polymarket and SynthData.\n\nYou can set up alerts for sharp market changes and capitalize on them.\n\n🔎 Find more information and features on our website - <a href="https://presynth.net">presynth.net</a>`;
    bot.sendMessage(msg.chat.id, infoText, { parse_mode: "HTML", reply_markup: mainMenuOpts.reply_markup, disable_web_page_preview: true });
});

bot.onText(/Markets/, (msg) => {
    bot.sendMessage(msg.chat.id, "To view and track markets, please visit our web interface at https://presynth.net/markets", { reply_markup: mainMenuOpts.reply_markup });
});

async function sendSubscriptionsList(chatId, messageId = null) {
    const subs = userSubscriptions.get(chatId);

    if (!subs || subs.size === 0) {
        const text = "You are not tracking any markets.";
        if (messageId) {
            bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
        } else {
            bot.sendMessage(chatId, text, { reply_markup: mainMenuOpts.reply_markup });
        }
        return;
    }

    const inline_keyboard = [];
    for (const slug of subs) {
        const title = escapeHTML(await getMarketTitle(slug));
        inline_keyboard.push([{ text: title, callback_data: `ask:${slug.substring(0, 40)}` }]); // substring to avoid callback_data limit
    }

    const text = "<b>Your tracked markets:</b>\n<i>Click a market to remove it</i>";
    const opts = { parse_mode: "HTML", reply_markup: { inline_keyboard } };

    if (messageId) {
        bot.editMessageText(text, Object.assign({ chat_id: chatId, message_id: messageId }, opts));
    } else {
        bot.sendMessage(chatId, text, opts);
    }
}

bot.onText(/Tracked Markets/, async (msg) => {
    await sendSubscriptionsList(msg.chat.id);
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data === 'list_subs') {
        await sendSubscriptionsList(chatId, messageId);
        bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('ask:')) {
        const slugPrefix = data.split(':')[1];

        // Find the full slug that matches the prefix
        const subs = userSubscriptions.get(chatId) || new Set();
        let fullSlug = slugPrefix;
        for (const s of subs) {
            if (s.startsWith(slugPrefix)) {
                fullSlug = s;
                break;
            }
        }

        const title = escapeHTML(await getMarketTitle(fullSlug));

        const text = `Do you want to stop tracking:\n\n<b>${title}</b>?`;
        const opts = {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ Yes", callback_data: `del:${slugPrefix}` },
                        { text: "❌ No", callback_data: `list_subs` }
                    ]
                ]
            }
        };
        bot.editMessageText(text, opts);
        bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('del:')) {
        const slugPrefix = data.split(':')[1];
        if (userSubscriptions.has(chatId)) {
            const subs = userSubscriptions.get(chatId);
            for (const s of subs) {
                if (s.startsWith(slugPrefix)) {
                    subs.delete(s);
                    break;
                }
            }
        }
        bot.answerCallbackQuery(query.id, { text: "Market removed" });
        await sendSubscriptionsList(chatId, messageId);
    }
});

// Example of how an alert would be triggered (this could be called by a cron job checking the SynthData API)
// For demonstration, we'll listen for a secret admin command to simulate an alert
bot.onText(/\/simulate_alert (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const targetSlug = match[1];

    if (!userSubscriptions.has(chatId) || !userSubscriptions.get(chatId).has(targetSlug)) {
        bot.sendMessage(chatId, "You are not subscribed to this market.");
        return;
    }

    const title = escapeHTML(await getMarketTitle(targetSlug));
    const polymarketUrl = `https://polymarket.com/event/${targetSlug}`;
    const presynthUrl = `https://presynth.net/markets/${targetSlug}`;

    const alertMessage = `🚨 <b>PreSynth Alert Triggered</b>\n\n<blockquote>Market: ${title}\nSignal: High Tail Risk Detected\nCrash Probability: &gt; 8%</blockquote>\n\n<a href="${polymarketUrl}">Market on Polymarket</a> | <a href="${presynthUrl}">PreSynth</a>`;

    bot.sendMessage(chatId, alertMessage, { parse_mode: "HTML", disable_web_page_preview: true });
});

bot.on("polling_error", console.log);
