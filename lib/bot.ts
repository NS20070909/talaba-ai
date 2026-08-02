import { Telegraf } from "telegraf";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

let commandsRegistered = false;

export async function ensureTelegramCommandsRegistered() {
  if (commandsRegistered) return;
  try {
    const fullCommandsList = [
      { command: "start", description: "🚀 Botni ishga tushirish" },
      { command: "quiz", description: "🧠 Quiz yaratish (PDF, DOCX, TXT, Rasm)" },
      { command: "scan", description: "📸 Bilet Scan" },
      { command: "history", description: "📜 Quizlar tarixi va harakatlar" },
      { command: "statistika", description: "📊 Quiz statistikasi va limit holati" },
      { command: "help", description: "🆘 Yordam markazi" },
      { command: "help_quiz", description: "ℹ️ Quiz yo'riqnomasi va formatlar" },
      { command: "about", description: "ℹ️ Platforma haqida" },
      { command: "premium", description: "👑 Premium tariflar" },
    ];

    // Get existing commands first to merge, never overwrite
    let mergedCommands = fullCommandsList;
    try {
      const existing = await bot.telegram.getMyCommands();
      if (existing && existing.length > 0) {
        const cmdMap = new Map<string, string>();
        existing.forEach((c) => cmdMap.set(c.command, c.description));
        fullCommandsList.forEach((c) => cmdMap.set(c.command, c.description));
        mergedCommands = Array.from(cmdMap.entries()).map(([command, description]) => ({ command, description }));
      }
    } catch {}

    await bot.telegram.setMyCommands(mergedCommands);
    await bot.telegram.setMyCommands(mergedCommands, { scope: { type: "all_private_chats" } });
    await bot.telegram.setMyCommands(
      [
        { command: "quiz", description: "🧠 Guruhda quiz yaratish" },
        { command: "help_quiz", description: "ℹ️ Guruh quiz yo'riqnomasi" },
      ],
      { scope: { type: "all_group_chats" } }
    );

    commandsRegistered = true;
    console.log("✅ Telegram slash commands registered via Bot API setMyCommands (merged)");
  } catch (err: any) {
    console.error("Failed to setMyCommands:", err?.message || err);
  }
}
