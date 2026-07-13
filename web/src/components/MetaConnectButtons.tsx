"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";

// One-click Meta connect: WhatsApp via Embedded Signup, Messenger+Instagram
// via Facebook Login for Business. Both ride on the platform's own Meta app
// (NEXT_PUBLIC_META_APP_ID) — the agent never sees a token or a phone number
// ID, they just log in and pick their business.
//
// Renders nothing (parent falls back to manual paste) until the platform's
// Meta app is actually configured, and until Meta finishes App Review the
// login dialog will only complete for people with a role on that Meta app —
// see DEPLOYMENT.md for the setup checklist.

declare global {
  interface Window {
    FB?: {
      init: (opts: { appId: string; version: string; xfbml: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const WA_CONFIG_ID = process.env.NEXT_PUBLIC_META_WA_CONFIG_ID;
const LOGIN_CONFIG_ID = process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID;
const GRAPH_VERSION = "v21.0";

function useFacebookSdk() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!APP_ID) return;
    if (window.FB) {
      setReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: APP_ID, version: GRAPH_VERSION, xfbml: false });
      setReady(true);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);
  return ready;
}

export function MetaConnectButtons({ onConnected }: { onConnected: () => void }) {
  const sdkReady = useFacebookSdk();
  if (!APP_ID) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {WA_CONFIG_ID && <WhatsAppConnectCard sdkReady={sdkReady} onConnected={onConnected} />}
      {LOGIN_CONFIG_ID && <FacebookConnectCard sdkReady={sdkReady} onConnected={onConnected} />}
    </div>
  );
}

function WhatsAppConnectCard({ sdkReady, onConnected }: { sdkReady: boolean; onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const signupData = useRef<{ phoneNumberId?: string; wabaId?: string; code?: string }>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = JSON.parse(typeof event.data === "string" ? event.data : "{}");
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH") {
          signupData.current.phoneNumberId = data.data?.phone_number_id;
          signupData.current.wabaId = data.data?.waba_id;
          maybeFinish();
        } else if (data.event === "CANCEL" || data.event === "ERROR") {
          setBusy(false);
          setError(data.data?.error_message || "WhatsApp signup was cancelled.");
        }
      } catch {
        // Not a WA_EMBEDDED_SIGNUP message — ignore.
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function maybeFinish() {
    const { code, phoneNumberId, wabaId } = signupData.current;
    if (!code || !phoneNumberId || !wabaId) return; // wait for both the postMessage and the FB.login callback
    try {
      const res = await fetch("/api/channels/whatsapp/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneNumberId, wabaId }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to finish connecting WhatsApp.");
        return;
      }
      setDone(true);
      onConnected();
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!window.FB) return;
    setError(null);
    setBusy(true);
    signupData.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setBusy(false);
          if (response.status !== "connected") setError("WhatsApp connection was cancelled.");
          return;
        }
        signupData.current.code = code;
        maybeFinish();
      },
      {
        config_id: WA_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      }
    );
  }

  return (
    <ConnectCard
      title="WhatsApp Business"
      description="Log in with Facebook and pick your WhatsApp number — no phone number ID or token to copy."
      done={done}
      error={error}
      busy={busy}
      disabled={!sdkReady}
      onClick={start}
    />
  );
}

function FacebookConnectCard({ sdkReady, onConnected }: { sdkReady: boolean; onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pages, setPages] = useState<{ id: string; name: string; hasInstagram: boolean }[] | null>(null);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);

  async function finalize(pageId: string) {
    if (!selectionToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/channels/facebook-login/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionToken, pageId, connectInstagram: true }),
      });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to finish connecting.");
        return;
      }
      setDone(true);
      setPages(null);
      onConnected();
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!window.FB) return;
    setError(null);
    setBusy(true);
    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setBusy(false);
          if (response.status !== "connected") setError("Facebook login was cancelled.");
          return;
        }
        try {
          const res = await fetch("/api/channels/facebook-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (!res.ok) {
            setError((await res.json()).error || "Failed to look up your Facebook Pages.");
            return;
          }
          const json = await res.json();
          setSelectionToken(json.selectionToken);
          if (json.pages.length === 1) {
            await finalize(json.pages[0].id);
          } else {
            setPages(json.pages);
            setBusy(false);
          }
        } catch {
          setBusy(false);
          setError("Something went wrong reaching Facebook.");
        }
      },
      { config_id: LOGIN_CONFIG_ID, response_type: "code", override_default_response_type: true }
    );
  }

  if (pages) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 space-y-3">
        <div className="font-semibold text-sm">Which Page is this?</div>
        <div className="space-y-1.5">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => finalize(p.id)}
              disabled={busy}
              className="w-full text-left rounded-xl border border-black/[0.08] px-3.5 py-2.5 text-sm hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-50"
            >
              {p.name}
              {p.hasInstagram && <span className="text-xs text-black/40"> · Instagram linked</span>}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <ConnectCard
      title="Messenger & Instagram"
      description="Log in with Facebook and pick your Page — connects Messenger and any linked Instagram account together."
      done={done}
      error={error}
      busy={busy}
      disabled={!sdkReady}
      onClick={start}
    />
  );
}

function ConnectCard(props: {
  title: string;
  description: string;
  done: boolean;
  error: string | null;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 space-y-3">
      <div>
        <div className="font-semibold text-sm">{props.title}</div>
        <p className="text-xs text-black/45 mt-1">{props.description}</p>
      </div>
      {props.error && <p className="text-xs text-red-600">{props.error}</p>}
      <Button onClick={props.onClick} disabled={props.disabled || props.busy} className="w-full justify-center">
        {props.done ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="w-4 h-4" /> Connected
          </span>
        ) : props.busy ? (
          "Connecting…"
        ) : (
          "Connect with Facebook"
        )}
      </Button>
    </div>
  );
}
