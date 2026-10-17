"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLogin ? "Log in to continue learning." : "An admin will review and approve your account."}
        </p>
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      {next && <input type="hidden" name="next" value={next} />}
      {!isLogin && (
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" autoComplete="name" required minLength={2} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {!isLogin && (
        <>
          <div>
            <label className="label" htmlFor="telegramId">Telegram ID</label>
            <input className="input" id="telegramId" name="telegramId" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="uid">UID</label>
            <input className="input" id="uid" name="uid" required />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" required
          autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? undefined : 8} />
        {!isLogin && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
      </div>
      <SubmitButton className="btn btn-primary w-full py-2.5" pendingText={isLogin ? "Logging in…" : "Creating account…"}>
        {isLogin ? "Log in" : "Create account"}
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">
        {isLogin ? "New here? " : "Already registered? "}
        <Link className="font-medium text-brand-600 hover:underline" href={isLogin ? "/register" : "/login"}>
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
