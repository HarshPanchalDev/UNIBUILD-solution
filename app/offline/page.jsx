import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Offline · UNIBUILD" };
export const dynamic = "force-static";

// Shown by the service worker when the phone has no internet. Static: no partner data here.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <LogoMark className="h-12 w-12" />
      <WifiOff className="mt-8 h-10 w-10 text-slate-400" />
      <h1 className="mt-4 font-display text-xl font-bold text-navy-900">आप ऑफ़लाइन हैं · You are offline</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">अपने ताज़ा पॉइंट्स देखने के लिए इंटरनेट से जुड़ें। Connect to the internet to see your latest points.</p>
      <a href="/partner" className="mt-6 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white">फिर से कोशिश करें · Try again</a>
    </div>
  );
}
