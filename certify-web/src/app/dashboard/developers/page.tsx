"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { listApiKeys, createApiKey, revokeApiKey, type ApiKey } from "@/lib/apiKeys";
import { useI18n } from "@/components/LocaleProvider";
import { IconKey, IconTrash, IconCopy, IconCheck, IconBolt } from "@/components/icons";

export default function DevelopersPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale, { numberingSystem: "latn", dateStyle: "medium" }) : t("dev.dash");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hasApi, setHasApi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null); // shown once
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listApiKeys();
      setKeys(r.data);
      setHasApi(r.has_api);
    } catch {
      setError(t("dev.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
  }, [router, load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createApiKey(name);
      setNewKey(created.key);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dev.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(k: ApiKey) {
    if (!confirm(t("dev.confirmRevoke", { name: k.name }))) return;
    try {
      await revokeApiKey(k.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dev.revokeFailed"));
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">{t("dev.loading")}</div>;
  }

  const base = `${API_URL}/api/v1`;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">{t("dev.title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("dev.subtitle")}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <IconKey className="h-6 w-6" />
        </span>
      </div>

      {!hasApi ? (
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
            <IconBolt className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-xl font-black text-ink">{t("dev.paidTitle")}</h2>
          <p className="mt-2 text-sm text-ink-soft">{t("dev.paidBody")}</p>
          <Link href="/dashboard/billing" className="btn-primary mt-5 inline-flex">{t("dev.upgrade")}</Link>
        </div>
      ) : (
        <>
          {/* raw key reveal (once) */}
          {newKey && (
            <div className="card border border-verify-200 bg-verify-50/50 p-5">
              <p className="text-sm font-extrabold text-verify-700">{t("dev.createdReveal")}</p>
              <p className="mt-1 text-xs text-ink-soft">{t("dev.createdRevealSub")}</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-ink/90 px-3 py-2 font-mono text-xs text-white">{newKey}</code>
                <button onClick={copyKey} className="btn-ghost shrink-0">
                  {copied ? <><IconCheck className="h-4 w-4 text-verify-600" /> {t("dev.copied")}</> : <><IconCopy className="h-4 w-4" /> {t("dev.copy")}</>}
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="mt-3 text-xs font-bold text-ink-muted hover:text-ink">{t("dev.hide")}</button>
            </div>
          )}

          {/* create */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("dev.createTitle")}</h2>
            <form onSubmit={onCreate} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}
                placeholder={t("dev.keyNamePh")}
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                <IconKey className="h-4 w-4" /> {busy ? t("dev.creating") : t("dev.createKey")}
              </button>
            </form>
            {error && <p className="mt-2 text-sm font-bold text-red-600">{error}</p>}
          </div>

          {/* list */}
          <div className="card overflow-hidden">
            <div className="border-b px-6 py-4">
              <h2 className="font-display text-lg font-extrabold text-ink">{t("dev.yourKeys")}</h2>
            </div>
            {keys.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-ink-muted">{t("dev.noKeys")}</p>
            ) : (
              <ul className="divide-y">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 px-6 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-soft">
                      <IconKey className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{k.name}</p>
                      <p className="font-mono text-xs text-ink-muted">{k.masked}</p>
                    </div>
                    <span className="hidden text-xs text-ink-muted sm:block">{t("dev.lastUsed")} {fmt(k.last_used_at)}</span>
                    <button onClick={() => onRevoke(k)} title={t("dev.revokeTitle")}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* docs */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold text-ink">{t("dev.quickStart")}</h2>
            <p className="mt-2 text-sm text-ink-soft">{t("dev.sendHeaderA")} <code className="font-mono">Authorization</code>. {t("dev.base")}</p>
            <code className="mt-2 block rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-ink" dir="ltr">{base}</code>
            <p className="mt-4 text-sm font-bold text-ink">{t("dev.issueCert")}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/90 p-4 font-mono text-xs leading-relaxed text-white" dir="ltr">{`curl -X POST ${base}/certificates \\
  -H "Authorization: Bearer cfy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"recipient_name":"Ahmed Ali","course_name":"Cybersecurity"}'`}</pre>
            <p className="mt-4 text-sm font-bold text-ink">{t("dev.endpoints")}</p>
            <ul className="mt-2 space-y-1 text-xs text-ink-soft" dir="ltr">
              <li><span className="font-mono text-brand-700">POST</span> /certificates — {t("dev.epIssue")}</li>
              <li><span className="font-mono text-brand-700">GET</span> /certificates — {t("dev.epList")}</li>
              <li><span className="font-mono text-brand-700">GET</span> /certificates/:id — {t("dev.epOne")}</li>
            </ul>
          </div>
        </>
      )}
    </main>
  );
}
