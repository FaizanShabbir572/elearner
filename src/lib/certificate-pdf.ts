import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type CertData = {
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  certificateNumber: string;
};

const BLUE = rgb(0, 0.42, 1); // TWR electric blue (#006BFF)
const GOLD = rgb(0.78, 0.6, 0.18);
const INK = rgb(0.12, 0.13, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const { width } = page.getSize();
  // Shrink long text to fit within the inner border.
  let s = size;
  while (s > 10 && font.widthOfTextAtSize(text, s) > width - 160) s -= 1;
  page.drawText(text, { x: (width - font.widthOfTextAtSize(text, s)) / 2, y, size: s, font, color });
}

// Standard PDF fonts only support WinAnsi; replace anything else so generation never fails.
const safe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export async function renderCertificatePdf(data: CertData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate - ${safe(data.courseTitle)}`);
  const page = pdf.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.98, 0.96) });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: BLUE, borderWidth: 4 });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: GOLD, borderWidth: 1.2 });

  centered(page, "CERTIFICATE OF COMPLETION", height - 120, sansBold, 30, BLUE);
  page.drawLine({ start: { x: width / 2 - 90, y: height - 138 }, end: { x: width / 2 + 90, y: height - 138 }, thickness: 1.5, color: GOLD });

  centered(page, "This is to certify that", height - 190, serifItalic, 18, MUTED);
  centered(page, safe(data.studentName), height - 250, serifBold, 42, INK);
  page.drawLine({ start: { x: width / 2 - 220, y: height - 264 }, end: { x: width / 2 + 220, y: height - 264 }, thickness: 0.8, color: MUTED });

  centered(page, "has successfully completed the course", height - 305, serifItalic, 18, MUTED);
  centered(page, safe(data.courseTitle), height - 350, serifBold, 28, BLUE);

  const date = data.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const colY = 120;
  for (const [x, label, value] of [
    [width / 2 - 200, "Date of completion", date],
    [width / 2 + 200, "Certificate No.", data.certificateNumber],
  ] as const) {
    page.drawLine({ start: { x: x - 110, y: colY + 22 }, end: { x: x + 110, y: colY + 22 }, thickness: 0.8, color: MUTED });
    page.drawText(value, { x: x - serif.widthOfTextAtSize(value, 15) / 2, y: colY + 30, size: 15, font: serif, color: INK });
    page.drawText(label, { x: x - sans.widthOfTextAtSize(label, 10) / 2, y: colY + 6, size: 10, font: sans, color: MUTED });
  }

  return pdf.save();
}
