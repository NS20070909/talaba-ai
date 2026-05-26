import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        {
          result: "❌ Rasm topilmadi",
        },
        { status: 400 }
      );
    }

    const prompt = `
Sen TALABA AI uchun PROFESSIONAL SHPARGALKA AI'san.

SENING VAZIFANG:

1. Rasm ichidagi BARCHA savollarni top.
2. Hech bir savolni tashlab ketma.
3. Jadval bo‘lsa uni to‘liq o‘qi.
4. Fan nomini top.
5. Bilet raqamini top.
6. Savollar sonini aniqlab, HAMMASIGA javob ber.
7. Agar 5 ta savol bo‘lsa 5 tasiga ham javob yoz.
8. OCR xato qilgan bo‘lsa ma'nosini tushunib to‘g‘rila.
9. Imtihonda aytsa bo‘ladigan darajada tushuntir.

JAVOB QOIDALARI:

- Juda uzun yozma.
- Har savolga 2–3 gap.
- Mazmunli yoz.
- Keraksiz gap yozma.
- Muhim joylarini punkt bilan ber.
- Kod bo‘lsa faqat C++ yoz.
- Kod qisqa va ishlaydigan bo‘lsin.
- Formula kerak bo‘lsa yoz.
- Markdown ishlatma.
- ###, **, \`\`\` ishlatma.

MUHIM:

Agar rasm sifati past bo‘lsa ham maksimal aniqlik bilan savollarni tushunishga harakat qil.

FORMAT:

📚 Fan: (fan nomi)

🎫 Bilet: (raqam)

1-savol

📌 Ta'rif:
(2-3 gap)

🔥 Muhim joylari:
• fakt
• fakt
• fakt

💡 Eslab qolish:
(1 gap)

Agar dasturlash savoli bo‘lsa:

🧠 Tushuntirish:
(qisqa tushuntir)

💻 C++ kodi:
(kod)

HAMMA SAVOLLARGA JAVOB BER.
SAVOL TASHLAB KETMA.
RASMNI DIQQAT BILAN O‘QI.
`;

    let responseText = "";

    // MODEL 1 — ASOSIY
    try {
      console.log(
        "✅ Gemini 2.5 Flash ishladi"
      );

      const model =
        genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

      const result =
        await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: image,
            },
          },
        ]);

      responseText =
        result.response.text();
    }

    // MODEL 2 — BACKUP
    catch (error1) {
      console.log(
        "❌ 2.5 Flash ishlamadi → Gemini 2 Flash"
      );

      try {
        const model =
          genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
          });

        const result =
          await model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: image,
              },
            },
          ]);

        responseText =
          result.response.text();
      }

      // MODEL 3 — KATTA LIMIT
      catch (error2) {
        console.log(
          "❌ Gemini 2 Flash ishlamadi → Gemma 4"
        );

        try {
          const model =
            genAI.getGenerativeModel({
              model: "gemma-4-27b-it",
            });

          const result =
            await model.generateContent([
              prompt,
              {
                inlineData: {
                  mimeType:
                    "image/jpeg",
                  data: image,
                },
              },
            ]);

          responseText =
            result.response.text();
        }

        // MODEL 4 — OXIRGI BACKUP
        catch (error3) {
          console.log(
            "❌ Gemma ishlamadi → Flash Lite"
          );

          const model =
            genAI.getGenerativeModel({
              model:
                "gemini-2.0-flash-lite",
            });

          const result =
            await model.generateContent([
              prompt,
              {
                inlineData: {
                  mimeType:
                    "image/jpeg",
                  data: image,
                },
              },
            ]);

          responseText =
            result.response.text();
        }
      }
    }

    return NextResponse.json({
      result: responseText,
    });
  } catch (error) {
    console.log(
      "❌ API ERROR:",
      error
    );

    return NextResponse.json(
      {
        result:
          "❌ AI vaqtincha ishlamayapti. Qayta urinib ko‘ring.",
      },
      { status: 500 }
    );
  }
}