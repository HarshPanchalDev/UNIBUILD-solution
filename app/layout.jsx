import { Inter, Poppins, Kaushan_Script, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-devanagari" });
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-poppins" });
const script = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan" });

export const metadata = {
  title: "UNIBUILD Partner App",
  description: "Earn points for bringing business to UNIBUILD. Track your points, view your sites and redeem rewards.",
  applicationName: "UNIBUILD Partner App",
  appleWebApp: { capable: true, title: "UNIBUILD", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#0b2a57",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi" className={`${inter.variable} ${devanagari.variable} ${poppins.variable} ${script.variable}`}>
      <body className="font-sans antialiased">
        {process.env.STAGING_MODE === "true" && (
          <div role="status" className="relative z-[100] bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-navy-900">
            DEMO / TEST SERVER — sample data only, sign-in codes shown on screen. Not the live UNIBUILD app.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
