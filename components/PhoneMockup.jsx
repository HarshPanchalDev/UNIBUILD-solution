import { Bell, Star, Home, MapPin, Gift, Menu, BadgeCheck } from "lucide-react";
import { LogoMark } from "./Logo";
// Decorative illustration only (sample values, hidden from screen readers).
const sample = { firstName: "Ramesh", code: "UBP-CO-0001", total: 2450, tier: "Silver" };

/** Decorative phone showing the partner app home screen (used on the landing page). */
export default function PhoneMockup({ className = "" }) {
  const tiles = [
    { icon: Star, label: "My Points" },
    { icon: Home, label: "My Sites" },
    { icon: Gift, label: "Rewards" },
    { icon: Bell, label: "Notices" },
  ];
  return (
    <div aria-hidden="true" className={`w-[230px] rounded-[2.4rem] bg-slate-900 p-2 shadow-2xl shadow-navy-950/50 ring-1 ring-white/10 ${className}`}>
      <div className="relative overflow-hidden rounded-[2rem] bg-white">
        <div className="absolute left-1/2 top-1.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="bg-navy-800 px-4 pb-3 pt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <LogoMark light className="h-5 w-5" />
              <div className="leading-none">
                <div className="font-display text-[11px] font-bold text-white">UNIBUILD</div>
                <div className="text-[6px] tracking-[0.25em] text-brand-400">PARTNER APP</div>
              </div>
            </div>
            <div className="relative">
              <Bell className="h-4 w-4 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </div>
          </div>
        </div>
        <div className="px-3 pb-2 pt-3">
          <div className="text-[13px] font-semibold text-navy-900">Hello, {sample.firstName}!</div>
          <div className="text-[9px] text-slate-500">Partner Code: {sample.code}</div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-400 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-brand-600 text-brand-600" />
              <div>
                <div className="text-[8px] font-medium text-navy-900/80">Your Points</div>
                <div className="font-display text-lg font-bold leading-tight text-navy-900">
                  {sample.total.toLocaleString("en-IN")} <span className="text-[9px]">pts</span>
                </div>
              </div>
            </div>
            <span className="flex items-center gap-0.5 rounded-md bg-white/80 px-1.5 py-0.5 text-[7px] font-semibold text-navy-800">
              <BadgeCheck className="h-2.5 w-2.5" /> {sample.tier} Tier
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {tiles.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 py-2.5">
                <Icon className="h-4 w-4 fill-navy-800 text-navy-800" />
                <span className="text-[8px] font-medium text-navy-900">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-around border-t border-slate-100 px-1 pb-3 pt-2">
          {[
            [Home, "Home"],
            [Star, "Points"],
            [MapPin, "Sites"],
            [Gift, "Rewards"],
            [Menu, "More"],
          ].map(([Icon, l], i) => (
            <div key={l} className={`flex flex-col items-center gap-0.5 ${i === 0 ? "text-navy-800" : "text-slate-400"}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[7px]">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
