
import { NextRequest, NextResponse } from "next/server";
import { checkReferatLimitAndUsage } from "../../lib/limit-checker";
import { Document, Paragraph, TextRun, Packer, AlignmentType } from "docx";

const generateReferatPrompt = (topic: string, requirements: string) => {
  return `Sizga talabalar uchun akademik referat yozishda yordam beradigan katta til modeli topshirildi. Quyidagi talablar asosida ilmiy uslubda, batafsil va tuzilgan referat yozing.

# Referat Mavzusi:
${topic}

# Qo'shimcha Talablar:
${requirements}

# Referat Strukturasi (Markdown formatida):

## Kirish
(Mavzuning dolzarbligi, maqsadi va vazifalari)

## Asosiy Qism
### 1. [Mavzuga oid birinchi bo'lim sarlavhasi]
(Bu yerda mavzuning birinchi asosiy jihati yoritiladi. Kerakli ma'lumotlar, tushunchalar va dalillar keltiriladi.)

### 2. [Mavzuga oid ikkinchi bo'lim sarlavhasi]
(Bu yerda mavzuning ikkinchi asosiy jihati yoritiladi. Tahlillar, misollar va taqqoslashlar beriladi.)

### 3. [Mavzuga oid uchinchi bo'lim sarlavhasi]
(Bu yerda mavzuning uchinchi asosiy jihati yoritiladi. Muammolar, yechimlar va kelajak istiqbollari muhokama qilinadi.)

## Xulosa
(Referatning asosiy natijalari, xulosalar va takliflar)

## Foydalanilgan Adabiyotlar Ro'yxati
(Kamida 3-5 ta ilmiy manba, kitob, maqola yoki veb-saytlar ro'yxati. Format:
1. Muallif. Asar nomi. Nashriyot/Jurnal, Yil.
2. Veb-sayt nomi. Havola.)

Yuqoridagi strukturaga qat'iy amal qiling va har bir bo'limni to'liq mazmun bilan to'ldiring.`;
};

const generateDocx = async (content: string): Promise<Buffer> => {
  const doc = new Document({
    sections: [
      {
        children: content.split('\n').map(line => {
          let textRun;
          if (line.startsWith('## ')) {
            textRun = new TextRun({
              text: line.substring(3),
              font: "Times New Roman",
              size: 28, // H2 equivalent (14pt * 2)
              bold: true,
            });
          } else if (line.startsWith('### ')) {
            textRun = new TextRun({
              text: line.substring(4),
              font: "Times New Roman",
              size: 24, // H3 equivalent (12pt * 2)
              bold: true,
            });
          } else if (line.startsWith('# ')) {
            textRun = new TextRun({
              text: line.substring(2),
              font: "Times New Roman",
              size: 32, // H1 equivalent (16pt * 2)
              bold: true,
            });
          } else {
            textRun = new TextRun({
              text: line,
              font: "Times New Roman",
              size: 28, // 14pt * 2
            });
          }

          return new Paragraph({
            children: [textRun],
            spacing: {
              line: 360, // 1.5 line spacing (240 per single line)
            },
            alignment: AlignmentType.JUSTIFIED,
          });
        }),
      },
    ],
  });

  return Packer.toBuffer(doc);
};

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      requirements
    } = await req.json();

    if (!topic) {
      return new NextResponse("Topic is required", {
        status: 400
      });
    }

    // Check referat limit
    const limitCheck = await checkReferatLimitAndUsage(req);
    if (limitCheck.hasLimitExceeded) {
      return new NextResponse(limitCheck.message, {
        status: 403
      });
    }

    // Generate prompt for AI model (assuming an AI model function exists elsewhere)
    const prompt = generateReferatPrompt(topic, requirements || "");
    // In a real application, you would call your AI model here
    // For now, we\'ll simulate an AI response based on the prompt structure
    const aiResponseContent = `## Kirish\nBu referatning asosiy maqsadi...\n\n### 1. Referatning birinchi asosiy qismi\nBu bo\'limda birinchi qism yoritiladi...\n\n### 2. Referatning ikkinchi asosiy qismi\nBu bo\'limda ikkinchi qism yoritiladi...\n\n## Xulosa\nXulosa qilib aytganda...\n\n## Foydalanilgan Adabiyotlar Ro\'yxati\n1. Adabiyot 1.\n2. Adabiyot 2.`;

    // Generate DOCX buffer
    const docxBuffer = await generateDocx(aiResponseContent);

    // Increment referat usage after successful generation
    await checkReferatLimitAndUsage(req, true);

    return new NextResponse(docxBuffer as Buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="referat_${Date.now()}.docx"`,
      },
    });
  } catch (error) {
    console.error("Error generating referat:", error);
    return new NextResponse("Internal Server Error", {
      status: 500
    });
  }
}
