"use client";

import { useEffect } from "react";
import { initTelegramWebApp } from "@/lib/client/telegram";

export default function TelegramInitializer() {
  useEffect(() => {
    const cleanup = initTelegramWebApp();
    return cleanup;
  }, []);

  return null;
}
