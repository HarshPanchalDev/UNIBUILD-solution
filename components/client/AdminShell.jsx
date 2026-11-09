"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Upload, AlertTriangle, MapPin, Users, Link2, Gift, Settings, BarChart3, ScrollText, Award, UserCog,
  Bell, Menu, X, Search, ChevronDown,
} from "lucide-react";
import Logo from "../Logo";
import LogoutButton from "./LogoutButton";
import { ToastProvider, callApi } from "./feedback";

const ICONS = { LayoutDashboard, Upload, AlertTriangle, MapPin, Users, Link2, Gift, Settings, BarChart3, ScrollText, Award, UserCog };

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function Notifications({ items, unread }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();
  useOutside(ref, () => setOpen(false));
  async function markAll() {
    await callApi("/api/admin/notifications", { body: { all: true } }).catch(() => {});
    router.refresh();
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications, ${unread} unread`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-navy-900">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-xs font-medium text-navy-600 hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No notifications</li>}
            {items.map((n) => (
              <li key={n.id} className={`px-4 py-3 ${n.readAt ? "" : "bg-brand-50/50"}`}>
                <p className="text-sm font-medium text-navy-900">{n.title}</p>
                <p className="text-xs text-slate-500">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AccountMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const initials = user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100" aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-navy-900">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-navy-900">{user.name}</span>
          <span className="block text-xs text-slate-500">{user.role === "OWNER" ? "Owner" : "Store Manager"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" role="menu">
          <div className="px-3 py-2 text-xs text-slate-500">Signed in as<br /><span className="font-medium text-navy-900">{user.email ?? user.mobile}</span></div>
          <LogoutButton className="w-full rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50" label="Sign out" iconClass="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export default function AdminShell({ nav, user, notifications, unread, children }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  const active = (href) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const NavList = () => (
    <nav className="space-y-0.5">
      {nav.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active(item.href) ? "bg-navy-600 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-[18px] w-[18px]" /> {item.label}
            </span>
            {item.badge > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-navy-900">{item.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy-900 px-4 py-6 lg:flex">
          <div className="mb-8 px-1">
            <Logo light subtitle="ADMIN PANEL" href="/admin" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavList />
          </div>
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <aside className="relative flex h-full w-64 flex-col bg-navy-900 px-4 py-6">
              <div className="mb-6 flex items-center justify-between px-1">
                <Logo light subtitle="ADMIN PANEL" href="/admin" />
                <button onClick={() => setDrawer(false)} className="text-white" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto"><NavList /></div>
            </aside>
          </div>
        )}

        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
            <button onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-navy-900 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <form action="/admin/search" method="get" className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input name="q" placeholder="Search partners, sites, phone…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-100" aria-label="Search" />
            </form>
            <div className="ml-auto flex items-center gap-1">
              <Notifications items={notifications} unread={unread} />
              <AccountMenu user={user} />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
