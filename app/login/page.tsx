"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, ArrowRight, X } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = searchParams.get("from") || "/";
      router.replace(from);
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/Tradiespace_Logo_Primary.png"
            alt="Tradiespace"
            width={196}
            height={48}
          />
        </div>

        {/* Card */}
        <div
          className="rounded-[24px] p-8"
          style={{ background: "var(--s1)", border: "1px solid var(--border-md)" }}
        >
          {/* Lock icon */}
          <div className="flex justify-center mb-5">
            <div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center"
              style={{ background: "var(--amber-lo)", border: "1px solid var(--amber-md)" }}
            >
              <Lock size={24} style={{ color: "var(--amber)" }} />
            </div>
          </div>

          <h1
            className="font-display font-bold text-[22px] text-center mb-1.5"
            style={{ color: "var(--text-1)", letterSpacing: "-0.015em" }}
          >
            Sign in
          </h1>
          <p
            className="text-[13px] text-center mb-7 leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            Enter the access password to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{
                background:    "var(--s2)",
                border:        `1.5px solid ${error ? "var(--red)" : "var(--border-md)"}`,
                color:         "var(--text-1)",
                fontFamily:    "inherit",
                transition:    "border-color var(--t) var(--ease)",
              }}
              onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "var(--amber)"; }}
              onBlur={(e)  => { if (!error) e.currentTarget.style.borderColor = "var(--border-md)"; }}
            />

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px]"
                style={{
                  background: "var(--red-lo)",
                  border:     "1px solid rgba(220,38,38,0.2)",
                  color:      "var(--red)",
                }}
              >
                <X size={13} strokeWidth={2.5} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold"
              style={{
                background:  "var(--amber)",
                color:       "#fff",
                border:      "none",
                cursor:      loading || !password.trim() ? "not-allowed" : "pointer",
                opacity:     loading || !password.trim() ? 0.5 : 1,
                fontFamily:  "inherit",
                boxShadow:   "0 4px 18px rgba(217,119,6,0.22)",
                transition:  "opacity var(--t) var(--ease)",
              }}
            >
              {loading ? "Signing in…" : <>Continue <ArrowRight size={14} color="#fff" /></>}
            </button>
          </form>
        </div>

        <p
          className="text-center text-[11px] mt-5"
          style={{ color: "var(--text-3)" }}
        >
          Tradiespace · Internal tool
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
