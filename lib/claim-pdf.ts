import { COMPANY } from "@/lib/company-config";
import { formatDate, formatDateTime } from "@/lib/format";
import { PdfKit } from "@/lib/pdf-kit";
import { noticeText, type NoticeKind } from "@/lib/cipaa";

function letterhead(pdf: PdfKit) {
  pdf.text(COMPANY.name, { size: 16, bold: true, gap: 0 });
  pdf.text(`CIDB ${COMPANY.cidbGrade}  ·  Reg. no. ${COMPANY.cidbRegNo}`, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  for (const line of COMPANY.addressLines) pdf.text(line, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  pdf.space(10);
}

export async function buildClaimCertificatePdf(d: {
  projectName: string;
  clientName: string | null;
  claimNumber: string;
  claimDate: Date;
  claimedText: string;
  netClaimText: string;
  certifiedText: string;
  certificateNumber: string;
  certifiedBy: string;
  certifiedAt: Date;
  remarks: string | null;
}) {
  const pdf = await PdfKit.create(`Certificate ${d.certificateNumber}`, `${d.projectName}  ·  ${d.certificateNumber}`);
  letterhead(pdf);
  pdf.text("CERTIFICATE OF PAYMENT CLAIM", { size: 16, bold: true, gap: 8 });
  pdf.pair("Certificate no.", d.certificateNumber);
  pdf.pair("Project", d.projectName);
  if (d.clientName) pdf.pair("Client", d.clientName);
  pdf.pair("Payment claim", `${d.claimNumber}, dated ${formatDate(d.claimDate)}`);
  pdf.pair("Amount claimed", d.claimedText);
  pdf.pair("Net claim (after retention)", d.netClaimText);
  pdf.pair("Amount certified", d.certifiedText);
  pdf.pair("Certified by", d.certifiedBy);
  pdf.pair("Certified on", formatDateTime(d.certifiedAt));
  if (d.remarks) pdf.pair("Remarks", d.remarks);
  pdf.space(30);
  pdf.text("Signature: ______________________________", { gap: 4 });
  pdf.text(d.certifiedBy, { size: 9, color: [0.35, 0.35, 0.4] });
  return pdf.finish();
}

export async function buildNoticePdf(kind: NoticeKind, d: Parameters<typeof noticeText>[1]) {
  const t = noticeText(kind, d);
  const pdf = await PdfKit.create(t.title, `${d.projectName}  ·  ${t.title}  ·  ${d.claimNumber}`);
  letterhead(pdf);
  pdf.text(t.title, { size: 16, bold: true, gap: 2 });
  pdf.text(t.subtitle, { size: 9, color: [0.35, 0.35, 0.4], gap: 10 });
  for (const p of t.paragraphs) pdf.text(p, { gap: 8 });
  pdf.space(24);
  pdf.text("Yours faithfully,", { gap: 24 });
  pdf.text(`For ${COMPANY.name}`, { bold: true, gap: 0 });
  pdf.text("[Name and title of authorised signatory]", { size: 9, color: [0.35, 0.35, 0.4] });
  return pdf.finish();
}
