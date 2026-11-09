import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-6 font-display text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">यह पेज नहीं मिला। The page you are looking for does not exist.</p>
      <Link href="/" className="mt-6 rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white">Home</Link>
    </div>
  );
}
