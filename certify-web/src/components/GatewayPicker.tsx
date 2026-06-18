"use client";

type Gateway = "stripe" | "tap" | "paymob";

type Props = {
  onSelect: (gateway: Gateway) => void;
  onClose: () => void;
  stripeAvailable: boolean;
  tapAvailable: boolean;
  paymobAvailable: boolean;
  loading?: boolean;
};

export function GatewayPicker({ onSelect, onClose, stripeAvailable, tapAvailable, paymobAvailable, loading }: Props) {
  const noneAvailable = !stripeAvailable && !tapAvailable && !paymobAvailable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl border border-line w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-ink">اختر طريقة الدفع</h3>
          <p className="text-sm text-ink-muted mt-1">جميع الخيارات آمنة ومشفّرة</p>
        </div>

        <div className="space-y-3">
          {/* Only configured gateways are shown — picking an unavailable one
              would fail at checkout. */}
          {/* Stripe — global */}
          {stripeAvailable && (
            <button
              onClick={() => onSelect("stripe")}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-line hover:border-brand-400 hover:bg-brand-50/30 transition-all group disabled:opacity-50 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 text-lg">
                💳
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink">Stripe</p>
                <p className="text-xs text-ink-muted">فيزا · ماستركارد · Apple Pay · دفع عالمي</p>
              </div>
              <span className="text-ink-muted group-hover:text-brand-600 transition-colors">←</span>
            </button>
          )}

          {/* Tap — GCC */}
          {tapAvailable && (
            <button
              onClick={() => onSelect("tap")}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-line hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group disabled:opacity-50 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-lg">
                🌍
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink">Tap Payments</p>
                <p className="text-xs text-ink-muted">مدى · STC Pay · فيزا · الخليج العربي</p>
              </div>
              <span className="text-ink-muted group-hover:text-emerald-600 transition-colors">←</span>
            </button>
          )}

          {/* Paymob — Egypt */}
          {paymobAvailable && (
            <button
              onClick={() => onSelect("paymob")}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-line hover:border-amber-400 hover:bg-amber-50/30 transition-all group disabled:opacity-50 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-lg">
                🇪🇬
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink">Paymob — مصر</p>
                <p className="text-xs text-ink-muted">فودافون كاش · إنستاباي · فوري · ميزة · بطاقات</p>
              </div>
              <span className="text-ink-muted group-hover:text-amber-600 transition-colors">←</span>
            </button>
          )}
        </div>

        {noneAvailable && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            لم تُضبط مفاتيح الدفع بعد — سيتم التفعيل مباشرةً في الوضع التجريبي.
          </p>
        )}

        <button onClick={onClose} className="w-full text-sm text-ink-muted hover:text-ink transition-colors py-1">
          إلغاء
        </button>
      </div>
    </div>
  );
}
