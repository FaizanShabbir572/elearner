import { requireApproved } from "@/lib/auth";
import { KeepItFresh } from "@/components/KeepItFresh";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Revision" };

export default async function RevisionPage() {
  const user = await requireApproved();
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-10">
      <PageHeader title="Revision" subtitle="Keep what you've learned fresh — picked automatically from your own progress." />
      <KeepItFresh user={user} variant="page" />
    </div>
  );
}
