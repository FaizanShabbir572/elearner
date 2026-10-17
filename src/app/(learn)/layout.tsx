import { requireApproved } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const user = await requireApproved();
  return <AppShell user={user}>{children}</AppShell>;
}
