import PDFDocument from "pdfkit";

export async function buildPdfFromText(
  text: string,
  originalFileName?: string
): Promise<{ buffer: Buffer; fileName: string }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const baseName = originalFileName
        ? originalFileName.replace(/\.(docx|pdf)$/i, "")
        : "tarjima";
      resolve({ buffer, fileName: `${baseName}_tarjima.pdf` });
    });
    doc.on("error", reject);

    doc.font("Times-Roman").fontSize(12);

    const paragraphs = text.split(/\n{2,}/);
    for (let i = 0; i < paragraphs.length; i++) {
      if (i > 0) doc.moveDown(0.5);
      doc.text(paragraphs[i].trim(), { align: "justify", lineGap: 4 });
    }

    doc.end();
  });
}
