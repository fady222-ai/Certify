"use client";

import { useT } from "@/components/LocaleProvider";

type Gateway = "stripe" | "tap" | "paymob";

type Props = {
  onSelect: (gateway: Gateway) => void;
  onClose: () => void;
  stripeAvailable: boolean;
  tapAvailable: boolean;
  paymobAvailable: boolean;
  loading?: boolean;
};

const GATEWAYS: {
  key: Gateway;
  emoji: string;
  iconBg: string;
  name: string;
  methodsKey: string;
  hover: string;
  arrowHover: string;
}[] = [
  { key: "stripe", emoji: "💳", iconBg: "bg-indigo-100", name: "Stripe", methodsKey: "gw.methodsStripe", hover: "hover:border-brand-400 hover:bg-brand-50/30", arrowHover: "group-hover:text-brand-600" },
  { key: "tap", emoji: "🌍", iconBg: "bg-emerald-100", name: "Tap Payments", methodsKey: "gw.methodsTap", hover: "hover:border-emerald-400 hover:bg-emerald-50/30", arrowHover: "group-hover:text-emerald-600" },
  { key: "paymob", emoji: "🇪🇬", iconBg: "bg-amber-100", name: "", methodsKey: "gw.methodsPaymob", hover: "hover:border-amber-400 hover:bg-amber-50/30", arrowHover: "group-hover:text-amber-600" },
];

export function GatewayPicker({ onSelect, onClose, stripeAvailable, tapAvailable, paymobAvailable, loading }: Props) {
  const t = useT();
  const availability: Record<Gateway, boolean> = { stripe: stripeAvailable, tap: tapAvailable, paymob: paymobAvailable };
  // Only payment methods the platform can actually process are shown — never a
  // disabled/greyed row. The page only opens this picker when 2+ are available.
  const usable = GATEWAYS.filter((g) => availability[g.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl border border-line w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-ink">{t("gw.title")}</h3>
          <p className="text-sm text-ink-muted mt-1">{t("gw.subtitle")}</p>
        </div>

        <div className="space-y-3">
          {usable.map((g) => (
            <button
              key={g.key}
              onClick={() => onSelect(g.key)}
              disabled={loading}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border border-line transition-all group text-start disabled:opacity-50 ${g.hover}`}
            >
              <div className={`w-10 h-10 rounded-xl ${g.iconBg} flex items-center justify-center flex-shrink-0 text-lg`}>
                {g.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink">{g.name || t("gw.paymobName")}</p>
                <p className="text-xs text-ink-muted">{t(g.methodsKey)}</p>
              </div>
              <span className={`text-ink-muted ${g.arrowHover} transition-colors`}>←</span>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="w-full text-sm text-ink-muted hover:text-ink transition-colors py-1">
          {t("gw.cancel")}
        </button>
      </div>
    </div>
  );
}
