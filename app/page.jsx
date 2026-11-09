import Link from "next/link";
import Image from "next/image";
import { UserPlus, MapPin, Star, Gift, ChevronRight, Globe, ShieldCheck, Users, HardHat, Wrench, Zap, Paintbrush, Lock, CalendarClock, Package, IndianRupee } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import PhoneMockup from "@/components/PhoneMockup";
import Logo from "@/components/Logo";
import { I18nProvider } from "@/components/client/I18n";
import InstallAppButton from "@/components/client/InstallAppButton";
import { getT } from "@/lib/i18n/server";
import { repo } from "@/lib/server/db";
import { getActiveSettings } from "@/lib/loyalty/settingsService";
import { DEFAULT_SETTINGS } from "@/lib/loyalty/settings";

export const dynamic = "force-dynamic";

const CATEGORY_TILES = [
  { key: 1, image: "/images/cat-cement.jpg", tint: "bg-sky-50" },
  { key: "waterproofing", image: "/images/cat-waterproofing.jpg", tint: "bg-sky-50", en: "Waterproofing", hi: "वॉटरप्रूफिंग" },
  { key: "hardware", image: "/images/cat-hardware.jpg", tint: "bg-orange-50", en: "Hardware", hi: "हार्डवेयर" },
  { key: 3, image: "/images/cat-plumbing.jpg", tint: "bg-slate-100" },
  { key: 4, image: "/images/cat-electrical.jpg", tint: "bg-orange-50" },
  { key: 5, image: "/images/cat-paint.jpg", tint: "bg-sky-50" },
];

async function liveSettings() {
  try {
    return (await getActiveSettings(repo)).values;
  } catch {
    return DEFAULT_SETTINGS; // landing page still works if the database is down
  }
}

export default async function LandingPage() {
  const { lang, t } = await getT();
  const st = await liveSettings();
  const r1 = st.rates[1];
  const r3 = st.rates[3];
  const m = st.multipliers;

  const steps = [
    { icon: UserPlus, title: t("landing.step1"), text: t("landing.step1Text"), tone: "navy" },
    { icon: MapPin, title: t("landing.step2"), text: t("landing.step2Text"), tone: "brand" },
    { icon: Star, title: t("landing.step3"), text: t("landing.step3Text"), tone: "navy" },
    { icon: Gift, title: t("landing.step4"), text: t("landing.step4Text"), tone: "brand" },
  ];
  const trades = [
    { icon: HardHat, name: t("trade.CONTRACTOR"), cats: `${t("category.1")}, ${t("category.2")}` },
    { icon: Wrench, name: t("trade.PLUMBER"), cats: t("category.3") },
    { icon: Zap, name: t("trade.ELECTRICIAN"), cats: t("category.4") },
    { icon: Paintbrush, name: t("trade.PAINTER"), cats: t("category.5") },
  ];
  const rules = [
    { icon: Package, title: r1.basis === "QUANTITY" ? `${r1.points} ${lang === "hi" ? "पॉइंट प्रति" : "point per"} ${r1.per > 1 ? `${r1.per} ` : ""}${lang === "hi" ? "बैग" : "bag"}` : t("landing.rule1"), text: t("landing.rule1Text") },
    { icon: IndianRupee, title: r3.basis === "VALUE" ? (lang === "hi" ? `₹${r3.per} पर ${r3.points} पॉइंट` : `${r3.points} point per ₹${r3.per}`) : t("landing.rule2"), text: t("landing.rule2Text") },
    { icon: Lock, title: lang === "hi" ? `${st.lockDays} दिन का लॉक` : `${st.lockDays}-day lock`, text: t("landing.rule3Text").replace("30", String(st.lockDays)) },
    { icon: CalendarClock, title: lang === "hi" ? `${st.expiryMonths} महीने की वैधता` : `${st.expiryMonths}-month validity`, text: t("landing.rule4Text").replace("12", String(st.expiryMonths)) },
  ];
  const tierLine = lang === "hi" ? `टियर से हर पॉइंट बढ़ता है: साथी ${m.SAATHI}×, सिल्वर ${m.SILVER}×, गोल्ड ${m.GOLD}×।` : `Tiers boost every point: Saathi ${m.SAATHI}×, Silver ${m.SILVER}×, Gold ${m.GOLD}×.`;

  return (
    <I18nProvider lang={lang}>
      <div className="bg-white">
        <SiteHeader />

        <section id="home" className="relative overflow-hidden bg-navy-900">
          <div className="absolute inset-0 lg:left-[30%] lg:right-[24%]">
            <Image src="/images/hero-worker.jpg" alt="" fill priority className="object-cover object-top opacity-40 lg:opacity-100" sizes="(min-width:1024px) 50vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/60 to-transparent lg:via-navy-900/10" />
          </div>
          <div className="absolute inset-y-0 right-0 hidden w-[26%] lg:block">
            <div className="hero-diagonal absolute inset-0 bg-navy-950" />
            <div className="absolute bottom-0 left-[22%] h-28 w-20 bg-brand-500 [clip-path:polygon(0_0,100%_100%,0_100%)]" />
            <div className="absolute right-0 top-0 h-24 w-16 bg-brand-500 [clip-path:polygon(100%_0,100%_100%,0_0)]" />
            <p className="absolute right-[4%] top-1/2 w-36 -translate-y-1/2 -rotate-12 font-script text-[28px] leading-snug text-brand-400">{t("landing.scriptLine")}</p>
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:py-20">
            <div className="max-w-xl">
              <p className="font-display text-2xl font-bold tracking-[0.12em] text-white sm:text-3xl">UNIBUILD</p>
              <h1 className="font-display text-5xl font-extrabold leading-[1.05] text-white sm:text-7xl">
                <span className="text-brand-500">Partner</span> App
              </h1>
              <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-[28px]">{t("landing.tagline")}</p>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-[17px]">{t("landing.intro")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <InstallAppButton />
                <Link href="/login" className="flex items-center gap-3 rounded-lg border border-white/40 bg-navy-950/40 px-5 py-2.5 text-white hover:bg-navy-950/70">
                  <Globe className="h-7 w-7" />
                  <span className="leading-tight">
                    <span className="block text-xs text-white/80">{t("landing.openWebSmall")}</span>
                    <span className="block text-base font-semibold">{t("landing.openWeb")}</span>
                  </span>
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:mr-[7vw] lg:items-center xl:mr-[8vw]">
              <PhoneMockup />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[300px_1fr] lg:items-center">
          <div>
            <p className={`text-xs font-bold text-navy-800 ${lang === "en" ? "tracking-[0.2em]" : "tracking-normal"}`}>{t("landing.materials")}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-navy-800 sm:text-4xl">{t("landing.categoriesTitle")}</h2>
            <p className="mt-3 text-slate-600">{t("landing.categoriesText")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {CATEGORY_TILES.map((c) => {
              const name = typeof c.key === "number" ? t(`category.${c.key}`) : c[lang] ?? c.en;
              return (
                <div key={c.key} className={`overflow-hidden rounded-xl ${c.tint} transition hover:-translate-y-0.5 hover:shadow-md`}>
                  <div className="relative aspect-[4/3]">
                    <Image src={c.image} alt={name} fill className="object-cover" sizes="200px" />
                  </div>
                  <p className="pb-4 pt-2 text-center text-sm font-bold tracking-wide text-navy-800">{lang === "en" ? name.toUpperCase() : name}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[330px_1fr] lg:items-center">
            <div>
              <p className={`text-xs font-bold text-navy-800 ${lang === "en" ? "tracking-[0.2em]" : "tracking-normal"}`}>{t("landing.howLabel")}</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-navy-800">{t("landing.howTitle")}</h2>
              <p className="mt-3 text-slate-600">{t("landing.howText")}</p>
            </div>
            <ol className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
              {steps.map((s, i) => (
                <li key={i} className="relative">
                  <div className="relative w-fit">
                    <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${s.tone === "navy" ? "bg-navy-800 text-white" : "bg-brand-500 text-navy-900"}`}>
                      <s.icon className={`h-8 w-8 ${s.tone === "navy" ? "fill-white" : "fill-navy-900"}`} />
                    </div>
                    <span className="absolute -bottom-1 left-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-navy-800 text-xs font-bold text-white">{i + 1}</span>
                  </div>
                  {i < steps.length - 1 && <ChevronRight className="absolute right-2 top-6 hidden h-6 w-6 text-slate-400 xl:block" />}
                  <h3 className="mt-4 font-display text-lg font-semibold text-navy-800">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className={`text-xs font-bold text-navy-800 ${lang === "en" ? "tracking-[0.2em]" : "tracking-normal"}`}>{t("landing.aboutLabel")}</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-navy-800">{t("landing.aboutTitle")}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{t("landing.aboutText")}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {trades.map((tr) => (
                  <div key={tr.name} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><tr.icon className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-navy-900">{tr.name}</p>
                      <p className="text-sm text-slate-500">{t("landing.earnsOn", { cats: tr.cats })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-navy-800 p-6 text-white sm:p-8">
              <h3 className="font-display text-xl font-semibold">{t("landing.rulesTitle")}</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {rules.map((r) => (
                  <div key={r.title} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                    <r.icon className="h-6 w-6 text-brand-400" />
                    <p className="mt-3 font-semibold">{r.title}</p>
                    <p className="text-sm text-white/70">{r.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-white/80">{tierLine}</p>
              <p className="mt-2 text-xs text-white/50">{t("landing.rulesNote")}</p>
            </div>
          </div>
        </section>

        <section className="bg-navy-900 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4 xl:border-r xl:border-brand-500/60 xl:pr-8">
              <Gift className="h-11 w-11 text-brand-500" />
              <p className="font-display text-2xl font-bold leading-tight">{t("landing.band1")}<br />{t("landing.band2")}</p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-5 lg:grid-cols-4 xl:px-6">
              {[[Star, t("landing.benefit1")], [MapPin, t("landing.benefit2")], [ShieldCheck, t("landing.benefit3")], [Users, t("landing.benefit4")]].map(([Icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon className="h-8 w-8 shrink-0 text-brand-500" />
                  <span className="text-sm text-white/90">{text}</span>
                </div>
              ))}
            </div>
            <Link href="/register" className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-500 px-7 py-3 font-semibold text-navy-900 hover:bg-brand-400">
              {t("landing.join")} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <footer className="bg-navy-950 text-white/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Logo light />
            <p>{t("landing.footer")} · © {new Date().getFullYear()} UNIBUILD</p>
            <Link href="/staff/login" className="text-white/50 hover:text-white">{t("landing.staffLogin")}</Link>
          </div>
        </footer>
      </div>
    </I18nProvider>
  );
}
