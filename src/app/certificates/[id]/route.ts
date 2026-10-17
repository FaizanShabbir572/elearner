import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) return NextResponse.redirect(new URL(`/login?next=/certificates/${id}`, req.url));

  const cert = await db.certificate.findUnique({ where: { id }, include: { user: true, course: true } });
  // Only the owner (or an admin) may download.
  if (!cert || (cert.userId !== user.id && user.role !== "ADMIN")) {
    return new NextResponse("Certificate not found", { status: 404 });
  }

  const pdf = await renderCertificatePdf({
    studentName: cert.user.name,
    courseTitle: cert.course.title,
    issuedAt: cert.issuedAt,
    certificateNumber: cert.certificateNumber,
  });
  const filename = `certificate-${cert.course.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
