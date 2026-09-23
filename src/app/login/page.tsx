import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in | Perstrive" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="flex items-center justify-center bg-sidebar px-6 py-6 md:w-60 md:flex-col md:items-start md:justify-between md:py-6">
        <Image src="/logo.png" alt="Perstrive" width={879} height={284} priority className="h-11 w-44 object-contain" />
        <span className="hidden text-xs text-white/40 md:block">Marketing Reporting</span>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">
            Live marketing performance across your locations
          </p>
          <LoginForm />
          <p className="mt-8 text-xs text-muted-foreground">
            Need access? Ask your Perstrive admin to add you.
          </p>
        </div>
      </main>
    </div>
  );
}
