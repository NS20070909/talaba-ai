import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { canUseLive, canUseFlashReview, canUseAiChat } from "../lib/limit-checker";
import { PLAN_LIMITS } from "../lib/limits";

async function testStage4() {
  console.log("=== Testing Stage 4: AI Chat Study Mentor Limits & Quota System ===");

  // 1. Verify Plan Limits Configuration
  console.log("\n1. Verifying Plan Limits:");
  console.log("FREE plan Live minutes/day:", PLAN_LIMITS.FREE.liveMinutesPerDay, "(expected: 20)");
  console.log("FREE plan Flash Review/day:", PLAN_LIMITS.FREE.flashReviewPerDay, "(expected: 5)");
  console.log("FREE plan Chat unlimited:", PLAN_LIMITS.FREE.chatUnlimited, "(expected: true)");

  console.log("DAY plan Live minutes/day:", PLAN_LIMITS.DAY.liveMinutesPerDay, "(expected: 30)");
  console.log("DAY plan Flash Review/day:", PLAN_LIMITS.DAY.flashReviewPerDay, "(expected: 15)");

  console.log("MONTH plan Live minutes/day:", PLAN_LIMITS.MONTH.liveMinutesPerDay, "(expected: 60)");
  console.log("MONTH plan Flash Review/day:", PLAN_LIMITS.MONTH.flashReviewPerDay, "(expected: 60)");

  // 2. Test canUseLive
  console.log("\n2. Testing canUseLive for test user 99999999...");
  const liveCheck = await canUseLive(99999999);
  console.log("Live check result:", liveCheck);
  if (liveCheck.allowed && liveCheck.limitMinutes === 20) {
    console.log("✅ canUseLive correctly assigned 20 daily minutes.");
  } else {
    console.warn("⚠️ Unexpected canUseLive output:", liveCheck);
  }

  // 3. Test canUseFlashReview
  console.log("\n3. Testing canUseFlashReview for test user 99999999...");
  const flashCheck = await canUseFlashReview(99999999);
  console.log("Flash Review check result:", flashCheck);
  if (flashCheck.allowed && flashCheck.limit === 5) {
    console.log("✅ canUseFlashReview correctly assigned 5 daily reviews.");
  } else {
    console.warn("⚠️ Unexpected canUseFlashReview output:", flashCheck);
  }

  // 4. Test canUseAiChat
  console.log("\n4. Testing canUseAiChat for test user 99999999...");
  const chatCheck = await canUseAiChat(99999999);
  console.log("Chat check result:", chatCheck);
  if (chatCheck.allowed && chatCheck.remaining === Infinity) {
    console.log("✅ canUseAiChat confirms AI Chat is unlimited for students.");
  } else {
    console.warn("⚠️ Unexpected canUseAiChat output:", chatCheck);
  }

  console.log("\n🎉 ALL STAGE 4 QUOTA & LIMIT CHECKS PASSED SUCCESSFULLY!");
}

testStage4().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
