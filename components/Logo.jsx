import Link from "next/link";

/** UNIBUILD house-arch mark. `light` = for dark (navy) backgrounds. */
export function LogoMark({ className = "h-9 w-9", light = false }) {
  const dark = light ? "#ffffff" : "#0b2a57";
  return (
    <svg viewBox="0 0 48 46" className={className} aria-hidden="true">
      <path d="M2 44V15L23 1v12L12 20.5V44z" fill="#fdb913" />
      <path d="M25 1l21 14v29H36V20.5L25 13z" fill={dark} />
      <path d="M19 24h10v20H19z" fill={dark} />
    </svg>
  );
}

export default function Logo({ light = false, subtitle = "PARTNER APP", href = "/", size = "md" }) {
  const big = size === "lg";
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark light={light} className={big ? "h-12 w-12" : "h-9 w-9"} />
      <span className="leading-none">
        <span
          className={`block font-display font-extrabold tracking-wide ${
            big ? "text-3xl" : "text-xl"
          } ${light ? "text-white" : "text-navy-800"}`}
        >
          UNIBUILD
        </span>
        {subtitle && (
          <span
            className={`mt-1 block text-[10px] font-medium tracking-[0.35em] ${
              light ? "text-brand-400" : "text-navy-700"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
