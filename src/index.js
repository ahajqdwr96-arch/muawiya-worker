export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Muawiya Bot is running", {
        headers: { "content-type": "text/plain; charset=UTF-8" }
      });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

      if (secret !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const update = await request.json();

      if (update.message) {
        await handleMessage(update.message, env);
      }

      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const user = message.from;
  const text = message.text || "";

  await env.DB.prepare(`
    INSERT INTO users (telegram_id, first_name, username)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_name = excluded.first_name,
      username = excluded.username
  `).bind(
    String(user.id),
    user.first_name || "",
    user.username || ""
  ).run();

  if (text === "/start") {
    return sendMessage(env, chatId,
      "أهلاً بك في بوت معاوية للأذكار والأدعية 🌿\n\nاختر من القائمة:",
      {
        keyboard: [
          [{ text: "🌅 أذكار الصباح" }, { text: "🌇 أذكار المساء" }],
          [{ text: "📿 المسبحة الإلكترونية" }],
          [{ text: "🤲 الأدعية" }, { text: "⚙️ الإعدادات" }]
        ],
        resize_keyboard: true
      }
    );
  }

  const replies = {
    "🌅 أذكار الصباح": "🌅 أذكار الصباح\n\nسيتم إضافة الأذكار الموثقة هنا.",
    "🌇 أذكار المساء": "🌇 أذكار المساء\n\nسيتم إضافة الأذكار الموثقة هنا.",
    "📿 المسبحة الإلكترونية": "📿 المسبحة الإلكترونية\n\nسيتم تطوير المسبحة التفاعلية.",
    "🤲 الأدعية": "🤲 الأدعية\n\nسيتم إضافة الأدعية هنا.",
    "⚙️ الإعدادات": "⚙️ إعدادات البوت\n\nسيتم إضافة خيارات التنبيهات هنا."
  };

  if (replies[text]) {
    return sendMessage(env, chatId, replies[text]);
  }
}

async function handleCallback(callback, env) {
  await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback.id })
    }
  );
}

async function sendMessage(env, chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  return fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}
