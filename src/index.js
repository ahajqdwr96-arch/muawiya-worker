
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🌅 أذكار الصباح" }, { text: "🌇 أذكار المساء" }],
    [{ text: "📿 المسبحة الإلكترونية" }],
    [{ text: "🤲 الأدعية" }, { text: "🕌 مواقيت الصلاة" }],
    [{ text: "📊 إحصائياتي" }, { text: "⚙️ الإعدادات" }],
    [{ text: "ℹ️ حول البوت" }]
  ],
  resize_keyboard: true
};

const ADHKAR = {
  morning: [
    ["أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.", 1],
    ["اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور.", 1],
    ["رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً.", 3],
    ["سبحان الله وبحمده.", 100],
    ["أستغفر الله وأتوب إليه.", 100],
    ["اللهم صل وسلم على نبينا محمد.", 10]
  ],
  evening: [
    ["أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.", 1],
    ["اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير.", 1],
    ["رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً.", 3],
    ["سبحان الله وبحمده.", 100],
    ["أستغفر الله وأتوب إليه.", 100],
    ["اللهم صل وسلم على نبينا محمد.", 10]
  ]
};

const DUAS = [
  "اللهم إنك عفو تحب العفو فاعف عني.",
  "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار.",
  "اللهم أعني على ذكرك وشكرك وحسن عبادتك.",
  "يا مقلب القلوب ثبت قلبي على دينك.",
  "اللهم إني أسألك الهدى والتقى والعفاف والغنى.",
  "رب اغفر لي ولوالدي وللمؤمنين يوم يقوم الحساب."
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Muawiya Bot is running 🌿");
    }

    if (url.pathname !== "/webhook" || request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    const secret = request.headers.get(
      "X-Telegram-Bot-Api-Secret-Token"
    );

    if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      await initializeDB(env);
      const update = await request.json();

      if (update.message) {
        await handleMessage(update.message, env);
      }

      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      }

      return new Response("OK");
    } catch (error) {
      console.error("Bot error:", error);
      return new Response("Internal Error", { status: 500 });
    }
  }
};

async function initializeDB(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      first_name TEXT DEFAULT '',
      username TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      telegram_id TEXT NOT NULL,
      stat_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (telegram_id, stat_date)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      telegram_id TEXT PRIMARY KEY,
      city TEXT DEFAULT '',
      country TEXT DEFAULT 'Turkey',
      waiting_city INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_tasbeeh (
      telegram_id TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      phrase TEXT DEFAULT 'سبحان الله'
    );
  `);
}

async function handleMessage(message, env) {
  if (!message.from || message.from.is_bot) return;

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = (message.text || "").trim();

  await env.DB.prepare(`
    INSERT INTO users (telegram_id, first_name, username)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_name = excluded.first_name,
      username = excluded.username
  `).bind(
    userId,
    message.from.first_name || "",
    message.from.username || ""
  ).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_settings (telegram_id)
    VALUES (?)
  `).bind(userId).run();

  const settings = await env.DB.prepare(
    "SELECT * FROM user_settings WHERE telegram_id = ?"
  ).bind(userId).first();

  if (settings?.waiting_city === 1 && !text.startsWith("/")) {
    await env.DB.prepare(`
      UPDATE user_settings
      SET city = ?, waiting_city = 0
      WHERE telegram_id = ?
    `).bind(text, userId).run();

    return sendMessage(
      env,
      chatId,
      `✅ تم حفظ مدينتك: ${text}\n\nيمكنك الآن طلب مواقيت الصلاة.`,
      MAIN_KEYBOARD
    );
  }

  if (text === "/start" || text === "🏠 القائمة الرئيسية") {
    return sendMessage(
      env,
      chatId,
      `السلام عليكم ورحمة الله وبركاته 🌿

أهلاً بك ${message.from.first_name || ""} في بوت معاوية للأذكار والأدعية.

اجعل لسانك رطباً بذكر الله، واختر من القائمة ما تريد:`,
      MAIN_KEYBOARD
    );
  }

  if (text === "/help") {
    return sendMessage(
      env,
      chatId,
      "📚 قائمة الأوامر:\n/start - تشغيل البوت\n/help - المساعدة\n\nيمكنك استخدام الأزرار الموجودة أسفل الشاشة.",
      MAIN_KEYBOARD
    );
  }

  if (text === "📿 المسبحة الإلكترونية") {
    return showTasbeeh(env, chatId, userId);
  }

  if (text === "🌅 أذكار الصباح") {
    return showAdhkar(env, chatId, "morning", 0);
  }

  if (text === "🌇 أذكار المساء") {
    return showAdhkar(env, chatId, "evening", 0);
  }

  if (text === "🤲 الأدعية") {
    const buttons = DUAS.map((_, i) => [{
      text: `الدعاء ${i + 1}`,
      callback_data: `dua_${i}`
    }]);

    return sendMessage(
      env,
      chatId,
      "🤲 اختر دعاءً من القائمة:",
      { inline_keyboard: buttons }
    );
  }

  if (text === "📊 إحصائياتي") {
    return showStats(env, chatId, userId);
  }

  if (text === "⚙️ الإعدادات") {
    return sendMessage(
      env,
      chatId,
      "⚙️ إعداداتك:\n\nيمكنك تحديد مدينتك لعرض مواقيت الصلاة.",
      {
        inline_keyboard: [
          [{ text: "📍 تحديد المدينة", callback_data: "set_city" }],
          [{ text: "🔙 القائمة الرئيسية", callback_data: "home" }]
        ]
      }
    );
  }

  if (text === "🕌 مواقيت الصلاة") {
    return showPrayerTimes(env, chatId, userId);
  }

  if (text === "ℹ️ حول البوت") {
    return sendMessage(
      env,
      chatId,
      "📿 معاوية | Muawiya\n\nبوت إسلامي للأذكار والأدعية والتسبيح ومواقيت الصلاة.\n\nنسأل الله أن يجعلنا وإياكم من الذاكرين الله كثيراً والذاكرات.",
      MAIN_KEYBOARD
    );
  }

  if (text === "/admin") {
    if (!env.ADMIN_ID || userId !== String(env.ADMIN_ID)) {
      return sendMessage(env, chatId, "⛔ هذا الأمر خاص بالمشرف.");
    }

    const users = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM users"
    ).first();

    return sendMessage(
      env,
      chatId,
      `👨‍💻 لوحة المشرف\n\n👥 عدد المستخدمين: ${users.total}`
    );
  }
}

async function showTasbeeh(env, chatId, userId) {
  const row = await env.DB.prepare(
    "SELECT count, phrase FROM user_tasbeeh WHERE telegram_id = ?"
  ).bind(userId).first();

  const count = row?.count || 0;
  const phrase = row?.phrase || "سبحان الله";

  return sendMessage(
    env,
    chatId,
    `📿 المسبحة الإلكترونية\n\nالذكر الحالي:\n${phrase}\n\n🔢 عدد التسبيحات: ${count}`,
    {
      inline_keyboard: [
        [{ text: "📿 سبّح", callback_data: "tasbeeh" }],
        [
          { text: "🔄 تصفير", callback_data: "reset_tasbeeh" },
          { text: "🔁 تغيير الذكر", callback_data: "change_phrase" }
        ],
        [{ text: "🔙 الرئيسية", callback_data: "home" }]
      ]
    }
  );
}

async function showAdhkar(env, chatId, type, index) {
  const list = ADHKAR[type];
  const item = list[index];

  if (!item) return;

  const title = type === "morning" ? "🌅 أذكار الصباح" : "🌇 أذكار المساء";

  return sendMessage(
    env,
    chatId,
    `${title}\n\n${item[0]}\n\n🔢 عدد المرات: ${item[1]}\n\n📖 الذكر ${index + 1} من ${list.length}`,
    {
      inline_keyboard: [
        [
          ...(index > 0 ? [{
            text: "⬅️ السابق",
            callback_data: `adhkar_${type}_${index - 1}`
          }] : []),
          ...(index < list.length - 1 ? [{
            text: "التالي ➡️",
            callback_data: `adhkar_${type}_${index + 1}`
          }] : [])
        ],
        [{ text: "🔙 الرئيسية", callback_data: "home" }]
      ]
    }
  );
}

async function showStats(env, chatId, userId) {
  const today = new Date().toISOString().slice(0, 10);

  const daily = await env.DB.prepare(`
    SELECT count FROM user_stats
    WHERE telegram_id = ? AND stat_date = ?
  `).bind(userId, today).first();

  const total = await env.DB.prepare(`
    SELECT SUM(count) AS total FROM user_stats
    WHERE telegram_id = ?
  `).bind(userId).first();

  const tasbeeh = await env.DB.prepare(`
    SELECT count FROM user_tasbeeh WHERE telegram_id = ?
  `).bind(userId).first();

  return sendMessage(
    env,
    chatId,
    `📊 إحصائياتك\n\n📅 تسبيحات اليوم: ${daily?.count || 0}\n📿 عداد المسبحة الحالي: ${tasbeeh?.count || 0}\n🏆 مجموع التسبيحات المسجلة: ${total?.total || 0}`,
    MAIN_KEYBOARD
  );
}

async function showPrayerTimes(env, chatId, userId) {
  const settings = await env.DB.prepare(
    "SELECT city, country FROM user_settings WHERE telegram_id = ?"
  ).bind(userId).first();

  if (!settings?.city) {
    return sendMessage(
      env,
      chatId,
      "📍 لم تحدد مدينتك بعد.\n\nادخل إلى الإعدادات واضغط تحديد المدينة.",
      {
        inline_keyboard: [
          [{ text: "📍 تحديد المدينة", callback_data: "set_city" }]
        ]
      }
    );
  }

  try {
    const params = new URLSearchParams({
      city: settings.city,
      country: settings.country || "Turkey",
      method: "3"
    });

    const response = await fetch(
      `https://api.aladhan.com/v1/timingsByCity?${params}`
    );

    const result = await response.json();

    if (result.code !== 200) throw new Error("Prayer API error");

    const t = result.data.timings;

    return sendMessage(
      env,
      chatId,
      `🕌 مواقيت الصلاة\n📍 ${settings.city}\n\n🌅 الفجر: ${t.Fajr}\n☀️ الشروق: ${t.Sunrise}\n🕛 الظهر: ${t.Dhuhr}\n🕒 العصر: ${t.Asr}\n🌇 المغرب: ${t.Maghrib}\n🌙 العشاء: ${t.Isha}\n\n📅 ${result.data.date.readable}`,
      MAIN_KEYBOARD
    );
  } catch (error) {
    return sendMessage(
      env,
      chatId,
      "تعذر جلب مواقيت الصلاة حالياً. تحقق من اسم المدينة وحاول مجدداً."
    );
  }
}

async function handleCallback(callback, env) {
  const chatId = callback.message.chat.id;
  const userId = String(callback.from.id);
  const data = callback.data || "";

  await answerCallback(env, callback.id);

  if (data === "home") {
    return sendMessage(env, chatId, "🏠 القائمة الرئيسية", MAIN_KEYBOARD);
  }

  if (data === "tasbeeh") {
    await env.DB.prepare(`
      INSERT INTO user_tasbeeh (telegram_id, count)
      VALUES (?, 1)
      ON CONFLICT(telegram_id)
      DO UPDATE SET count = count + 1
    `).bind(userId).run();

    const today = new Date().toISOString().slice(0, 10);

    await env.DB.prepare(`
      INSERT INTO user_stats (telegram_id, stat_date, count)
      VALUES (?, ?, 1)
      ON CONFLICT(telegram_id, stat_date)
      DO UPDATE SET count = count + 1
    `).bind(userId, today).run();

    return updateTasbeehMessage(env, callback.message, userId);
  }

  if (data === "reset_tasbeeh") {
    await env.DB.prepare(`
      INSERT INTO user_tasbeeh (telegram_id, count)
      VALUES (?, 0)
      ON CONFLICT(telegram_id) DO UPDATE SET count = 0
    `).bind(userId).run();

    return updateTasbeehMessage(env, callback.message, userId);
  }

  if (data === "change_phrase") {
    const phrases = [
      "سبحان الله",
      "الحمد لله",
      "الله أكبر",
      "لا إله إلا الله",
      "أستغفر الله",
      "لا حول ولا قوة إلا بالله"
    ];

    return sendMessage(
      env,
      chatId,
      "اختر الذكر الذي تريد التسبيح به:",
      {
        inline_keyboard: phrases.map((phrase, i) => [{
          text: phrase,
          callback_data: `phrase_${i}`
        }])
      }
    );
  }

  if (data.startsWith("phrase_")) {
    const phrases = [
      "سبحان الله",
      "الحمد لله",
      "الله أكبر",
      "لا إله إلا الله",
      "أستغفر الله",
      "لا حول ولا قوة إلا بالله"
    ];

    const index = Number(data.split("_")[1]);

    if (!phrases[index]) return;

    await env.DB.prepare(`
      INSERT INTO user_tasbeeh (telegram_id, count, phrase)
      VALUES (?, 0, ?)
      ON CONFLICT(telegram_id)
      DO UPDATE SET count = 0, phrase = excluded.phrase
    `).bind(userId, phrases[index]).run();

    return showTasbeeh(env, chatId, userId);
  }

  if (data === "set_city") {
    await env.DB.prepare(`
      UPDATE user_settings SET waiting_city = 1
      WHERE telegram_id = ?
    `).bind(userId).run();

    return sendMessage(
      env,
      chatId,
      "📍 أرسل اسم مدينتك باللغة الإنجليزية أو العربية.\n\nمثال: Gaziantep"
    );
  }

  if (data.startsWith("adhkar_")) {
    const parts = data.split("_");
    const type = parts[1];
    const index = Number(parts[2]);

    if (ADHKAR[type] && Number.isInteger(index)) {
      return showAdhkar(env, chatId, type, index);
    }
  }

  if (data.startsWith("dua_")) {
    const index = Number(data.split("_")[1]);
    if (!DUAS[index]) return;

    return sendMessage(
      env,
      chatId,
      `🤲 دعاء\n\n${DUAS[index]}`,
      {
        inline_keyboard: [
          [{ text: "🔙 الأدعية", callback_data: "duas_back" }],
          [{ text: "🏠 الرئيسية", callback_data: "home" }]
        ]
      }
    );
  }

  if (data === "duas_back") {
    const buttons = DUAS.map((_, i) => [{
      text: `الدعاء ${i + 1}`,
      callback_data: `dua_${i}`
    }]);

    return sendMessage(env, chatId, "🤲 اختر دعاءً:", {
      inline_keyboard: buttons
    });
  }
}

async function updateTasbeehMessage(env, message, userId) {
  const row = await env.DB.prepare(`
    SELECT count, phrase FROM user_tasbeeh
    WHERE telegram_id = ?
  `).bind(userId).first();

  const count = row?.count || 0;
  const phrase = row?.phrase || "سبحان الله";

  return editMessage(
    env,
    message.chat.id,
    message.message_id,
    `📿 المسبحة الإلكترونية\n\nالذكر الحالي:\n${phrase}\n\n🔢 عدد التسبيحات: ${count}`,
    {
      inline_keyboard: [
        [{ text: "📿 سبّح", callback_data: "tasbeeh" }],
        [
          { text: "🔄 تصفير", callback_data: "reset_tasbeeh" },
          { text: "🔁 تغيير الذكر", callback_data: "change_phrase" }
        ],
        [{ text: "🔙 الرئيسية", callback_data: "home" }]
      ]
    }
  );
}

async function answerCallback(env, callbackId) {
  return telegram(env, "answerCallbackQuery", {
    callback_query_id: callbackId
  });
}

async function sendMessage(env, chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text };

  if (replyMarkup) body.reply_markup = replyMarkup;

  return telegram(env, "sendMessage", body);
}

async function editMessage(env, chatId, messageId, text, replyMarkup) {
  return telegram(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup
  });
}

async function telegram(env, method, body) {
  return fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

