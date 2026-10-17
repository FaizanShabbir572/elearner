import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AppShell user={user}><div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">{children}</div></AppShell>;
}
