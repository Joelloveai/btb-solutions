import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;

/** The standard PDF fonts only draw Latin-1 (plus a few punctuation marks); anything else becomes "?" instead of crashing. */
const EXTRA = new Set([..."–—‘’“”•…€™"]);
export const pdfSafe = (text: string) =>
  Array.from(text.replace(/\r/g, "").replace(/\t/g, "  "))
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      return ch === "\n" || (code >= 32 && code < 127) || (code >= 160 && code <= 255) || EXTRA.has(ch) ? ch : "?";
    })
    .join("");

/** A small flowing-text writer over pdf-lib: headings, paragraphs, rows, images, page numbers. */
export class PdfKit {
  private page!: PDFPage;
  private y = 0;
  private constructor(
    readonly doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private mono: PDFFont,
    private footerText: string,
  ) {
    this.newPage();
  }

  static async create(title: string, footerText: string) {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setCreator("BTB Solutions");
    doc.setProducer("BTB Solutions");
    return new PdfKit(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), await doc.embedFont(StandardFonts.Courier), footerText);
  }

  get width() {
    return A4[0] - MARGIN * 2;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  /** Start a new page unless this much room is left. */
  ensure(height: number) {
    if (this.y - height < MARGIN + 20) this.newPage();
  }

  space(points: number) {
    this.y -= points;
  }

  private wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of pdfSafe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        // A single very long token (a hash, a URL) is cut so it never runs off the page.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          if (line) lines.push(line), (line = "");
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        const attempt = line ? `${line} ${rest}` : rest;
        if (font.widthOfTextAtSize(attempt, size) <= width) line = attempt;
        else lines.push(line), (line = rest);
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; mono?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.mono ? this.mono : opts.bold ? this.bold : this.regular;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(text, font, size, this.width - indent)) {
      this.ensure(size * 1.4);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
      this.y -= size * 1.4;
    }
    this.y -= opts.gap ?? 2;
  }

  heading(text: string, size = 14) {
    this.ensure(size * 3);
    this.space(6);
    this.text(text, { size, bold: true, gap: 4 });
    this.page.drawLine({ start: { x: MARGIN, y: this.y + 2 }, end: { x: MARGIN + this.width, y: this.y + 2 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.78) });
    this.space(4);
  }

  /** "Label    value" on one line (wrapping the value if long). */
  pair(label: string, value: string, labelWidth = 130) {
    const lines = this.wrap(value || "—", this.regular, 10, this.width - labelWidth);
    this.ensure(lines.length * 14);
    this.page.drawText(pdfSafe(label), { x: MARGIN, y: this.y - 10, size: 10, font: this.bold, color: rgb(0.35, 0.35, 0.4) });
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + labelWidth, y: this.y - 10, size: 10, font: this.regular, color: rgb(0.1, 0.1, 0.12) });
      this.y -= 14;
    }
  }

  /** Embeds a JPEG or PNG scaled to fit. Returns false for any other format (the caller notes it). */
  async image(bytes: Uint8Array, mime: string, maxWidth: number, maxHeight: number): Promise<boolean> {
    let img: PDFImage;
    try {
      if (mime === "image/jpeg") img = await this.doc.embedJpg(bytes);
      else if (mime === "image/png") img = await this.doc.embedPng(bytes);
      else return false;
    } catch {
      return false;
    }
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    this.ensure(h + 4);
    this.page.drawImage(img, { x: MARGIN, y: this.y - h, width: w, height: h });
    this.y -= h + 4;
    return true;
  }

  /** Numbers every page and returns the finished file. */
  async finish(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      page.drawText(pdfSafe(`${this.footerText}  ·  Page ${i + 1} of ${pages.length}`), { x: MARGIN, y: 24, size: 8, font: this.regular, color: rgb(0.5, 0.5, 0.55) });
    });
    return this.doc.save();
  }
}
