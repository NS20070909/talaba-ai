import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { guardCheck, canUseScan, incrementScan } from "@/lib/limit-checker";

export const maxDuration = 60;

const genAI =
  new GoogleGenerativeAI(
    process.env
      .GEMINI_API_KEY!
  );

export async function POST(
  req: Request
) {
  try {
    const {
      image,
      telegram_user_id,
    } =
      await req.json();

    if (!image) {
      return NextResponse.json(
        {
          result:
            "❌ Rasm topilmadi",
        },
        {
          status:
            400,
        }
      );
    }

    const telegramId = Number(telegram_user_id);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ error: "telegram_user_id is required" }, { status: 400 });
    }

    const guard = await guardCheck(telegramId);
    if (guard.blocked && guard.result?.banned) {
      return NextResponse.json(
        {
          success: false,
          code: "BANNED",
          message: "🚫 Siz bloklangansiz",
        },
        { status: 403 }
      );
    }

    const limitCheck = await canUseScan(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "LIMIT_REACHED",
          message: "Sizning kunlik Scan limiti tugagan.",
        },
        {
          status: 403,
        }
      );
    }

    const prompt = `
Sen TALABA AI uchun PROFESSIONAL SHPARGALKA AI'san.

SENING VAZIFANG:

1. Rasm ichidagi BARCHA savollarni top.
2. Hech bir savolni tashlab ketma.
3. Jadval, sxema yoki diagramma bo‘lsa uni to‘liq o‘qi va tushuntir.
4. Fan nomini top.
5. Bilet raqamini top.
6. Savollar sonini aniqlab, HAMMASIGA javob ber.
7. Agar 5 ta savol bo‘lsa 5 tasiga ham javob yoz.
8. OCR xato qilgan bo‘lsa ma'nosini tushunib to‘g‘rila.
9. Agar harf yoki so‘z buzilgan bo‘lsa, fan terminologiyasidan kelib chiqib mantiqan tikla.
10. Imtihonda aytsa bo‘ladigan darajada tushuntir.
11. Talaba eng yuqori ball olishi uchun faqat kerakli ma'lumotlarni yoz.
12. Savol tushunarsiz bo‘lsa ham mantiqan tiklashga harakat qil va baribir javob ber.

JAVOB QOIDALARI:

- Juda uzun yozma.
- Har savolga 2–4 ta mazmunli gap yoz.
- Mazmunli yoz.
- Keraksiz gap yozma.
- Suv gaplar yozma.
- Muhim joylarini punkt bilan ber.
- Eng ko‘p tushadigan imtihon faktlarini yoz.
- Kod bo‘lsa faqat C++ yoz.
- Kod qisqa, minimal va ishlaydigan bo‘lsin.
- Formula kerak bo‘lsa albatta yoz.
- Ta'riflarni sodda, lekin professional yoz.
- Markdown ishlatma.
- ###, **, \`\`\`, __ ishlatma.
- Matn oddiy va toza ko‘rinishda bo‘lsin.
- FORMATNI BUZMA.
- HAR BIR SAVOL UCHUN FORMATNI TAKRORLA.

MUHIM:

- Agar rasm sifati past, xira yoki qisman yopilgan bo‘lsa ham maksimal aniqlik bilan savollarni tushunishga harakat qil.
- Savollarni taxmin qilish kerak bo‘lsa, fan kontekstidan foydalanib eng ehtimolli variantni tanla.
- "O‘qiy olmadim" yoki "aniq ko‘rinmayapti" degan javob yozma.
- Savol tashlab ketma.
- Rasmni diqqat bilan bir necha marta tahlil qil.
- Javoblar imtihonda aytishga qulay va eslab qolishga oson bo‘lsin.

FORMAT:

📚 Fan: (fan nomi)

🎫 Bilet: (raqam)

1-savol

📌 Ta'rif:
(2-4 gap)

🔥 Muhim joylari:
• fakt
• fakt
• fakt

💡 Eslab qolish:
(1 ta eng sodda eslab qolish usuli yoki qiyoslash)

Agar dasturlash savoli bo‘lsa:

🧠 Tushuntirish:
(qisqa tushuntir)

💻 C++ kodi:
(kod)

HAMMA SAVOLLARGA JAVOB BER.
SAVOL TASHLAB KETMA.
FORMATNI BUZMA.
RASMNI DIQQAT BILAN O‘QI.
`;

    let responseText =
      "";

    // MODEL 1
    try {
      console.log(
        "✅ Gemini 2.5 Flash ishladi"
      );

      const model =
        genAI.getGenerativeModel(
          {
            model:
              "gemini-2.5-flash",
          }
        );

      const result =
        await model.generateContent(
          [
            prompt,
            {
              inlineData:
                {
                  mimeType:
                    "image/jpeg",
                  data:
                    image,
                },
            },
          ]
        );

      responseText =
        result.response.text();
    }

    // MODEL 2
    catch (error1) {
      console.log(
        "❌ 2.5 Flash ishlamadi → Gemini 3.1 Flash Lite"
      );

      try {
        const model =
          genAI.getGenerativeModel(
            {
              model:
                "gemini-3.1-flash-lite",
            }
          );

        const result =
          await model.generateContent(
            [
              prompt,
              {
                inlineData:
                  {
                    mimeType:
                      "image/jpeg",
                    data:
                      image,
                  },
              },
            ]
          );

        responseText =
          result.response.text();
      }

      // MODEL 3
      catch (
        error2
      ) {
        console.log(
          "❌ 3.1 Flash Lite ishlamadi → Gemini 2 Flash"
        );

        try {
          const model =
            genAI.getGenerativeModel(
              {
                model:
                  "gemini-2.0-flash",
              }
            );

          const result =
            await model.generateContent(
              [
                prompt,
                {
                  inlineData:
                    {
                      mimeType:
                        "image/jpeg",
                      data:
                        image,
                    },
                },
              ]
            );

          responseText =
            result.response.text();
        }

        // MODEL 4
        catch (
          error3
        ) {
          console.log(
            "❌ Gemini 2 Flash ishlamadi → Gemini 3 Flash"
          );

          try {
            const model =
              genAI.getGenerativeModel(
                {
                  model:
                    "gemini-3-flash",
                }
              );

            const result =
              await model.generateContent(
                [
                  prompt,
                  {
                    inlineData:
                      {
                        mimeType:
                          "image/jpeg",
                        data:
                          image,
                      },
                  },
                ]
              );

            responseText =
              result.response.text();
          }

          // MODEL 5
          catch (
            error4
          ) {
            console.log(
              "❌ Gemini 3 Flash ishlamadi → Gemini 2.5 Flash Lite"
            );

            try {
              const model =
                genAI.getGenerativeModel(
                  {
                    model:
                      "gemini-2.5-flash-lite",
                  }
                );

              const result =
                await model.generateContent(
                  [
                    prompt,
                    {
                      inlineData:
                        {
                          mimeType:
                            "image/jpeg",
                          data:
                            image,
                        },
                    },
                  ]
                );

              responseText =
                result.response.text();
            }

            // MODEL 6
            catch (
              error5
            ) {
              console.log(
                "❌ 2.5 Flash Lite ishlamadi → Gemini 2 Flash Lite"
              );

              const model =
                genAI.getGenerativeModel(
                  {
                    model:
                      "gemini-2.0-flash-lite",
                  }
                );

              const result =
                await model.generateContent(
                  [
                    prompt,
                    {
                      inlineData:
                        {
                          mimeType:
                            "image/jpeg",
                          data:
                            image,
                        },
                    },
                  ]
                );

              responseText =
                result.response.text();
            }
          }
        }
      }
    }

    if (telegramId && !isNaN(telegramId)) {
      await incrementScan(telegramId);
    }

    return NextResponse.json(
      {
        result:
          responseText,
      }
    );
  } catch (
    error
  ) {
    console.log(
      "❌ API ERROR:",
      error
    );

    return NextResponse.json(
      {
        result:
          "❌ AI vaqtincha ishlamayapti. Qayta urinib ko‘ring.",
      },
      {
        status:
          500,
      }
    );
  }
}