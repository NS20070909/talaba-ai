import { Telegraf } from "telegraf";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

let commandsRegistered = false;

export async function ensureTelegramCommandsRegistered() {
  if (commandsRegistered) return;
  try {
    const commands = [
      { command: "quiz", description: "🧠 Quiz yaratish (PDF, DOCX, TXT, Rasm)" },
      { command: "history", description: "📜 Quizlar tarixi va harakatlar" },
      { command: "statistika", description: "📊 Quiz statistikasi va limit holati" },
      { command: "help_quiz", description: "ℹ️ Quiz yo'riqnomasi va formatlar" },
      { command: "scan", description: "📸 Bilet Scan" },
      { command: "premium", description: "👑 Premium tariflar" },
      { command: "help", description: "🆘 Yordam markazi" },
      { command: "about", description: "ℹ️ Platforma haqida" },
    ];

    await bot.telegram.setMyCommands(commands);
    await bot.telegram.setMyCommands(commands, { scope: { type: "all_private_chats" } });
    await bot.telegram.setMyCommands(
      [
        { command: "quiz", description: "🧠 Guruhda quiz yaratish" },
        { command: "help_quiz", description: "ℹ️ Guruh quiz yo'riqnomasi" },
      ],
      { scope: { type: "all_group_chats" } }
    );

    commandsRegistered = true;
    console.log("✅ Telegram slash commands registered via Bot API setMyCommands");
  } catch (err: any) {
    console.error("Failed to setMyCommands:", err?.message || err);
  }
}
