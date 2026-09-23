"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChartColumn, LayoutDashboard, LogOut, Megaphone, Menu, Settings, X } from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/leaderboard", label: "Location Leaderboard", icon: ChartColumn },
  { href: "/announcements", label: "Announcements", icon: Megaphone, badge: true },
  { href: "/admin", label: "Admin Settings", icon: Settings, adminOnly: true },
];

type Props = { isAdmin: boolean; unread: number; userLabel: string };

function Logo({ className }: { className: string }) {
  return (
    <Image src="/logo.png" alt="Perstrive" width={879} height={284} priority className={className} />
  );
}

function SidebarBody({ isAdmin, unread, userLabel }: Props) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-6 py-6">
        <Logo className="h-11 w-44 object-contain" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/") ||
              (item.href === "/leaderboard" && pathname.startsWith("/location/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors " +
                (active ? "bg-primary text-white" : "text-white/70 hover:bg-white/5 hover:text-white")
              }
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && unread > 0 && !active && (
                <span className="text-xs font-bold text-primary">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4">
        <div className="truncate text-xs text-white/60">{userLabel}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-white/40">Marketing Reporting</span>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar md:flex">
        <SidebarBody {...props} />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar px-4 md:hidden">
        <Logo className="h-9 w-36 object-contain" />
        <button onClick={() => setOpen(true)} className="p-2 text-white" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/70"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody {...props} />
          </aside>
        </div>
      )}
    </>
  );
}
