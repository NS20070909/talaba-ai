import { NextResponse } from "next/server";
import { saveOrUpdateUser } from "@/lib/storage";
import { getVerifiedTelegramUser } from "@/lib/telegram-auth";

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const auth = await getVerifiedTelegramUser(req, body);

    if (!auth.authenticated || !auth.telegramId) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED_INVALID_INIT_DATA",
          message: "Telegram autentifikatsiyasi tasdiqlanmadi.",
        },
        { status: 401 }
      );
    }

    const telegramId = auth.telegramId;
    const firstName = auth.user?.firstName || body.first_name || "Telegram User";
    const username = auth.user?.username || body.username || undefined;

    const user = await saveOrUpdateUser(
      telegramId,
      firstName,
      username
    );

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("Sync user error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
