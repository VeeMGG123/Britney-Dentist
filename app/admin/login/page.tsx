
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) throw new Error("Invalid email or password.");

      if (!data.user) throw new Error("Login failed.");

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        throw new Error("You are not authorized as an admin.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your admin email first.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        }
      );

      if (error) throw error;

      setSuccess(
        "If this email belongs to an account, a password reset link has been sent. Please check your inbox."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send the reset email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5f1] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-400">
            Dental Clinic
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            DR. BRITNEY
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {mode === "login"
              ? "Admin Dashboard"
              : "Reset your password"}
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:bg-white"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:bg-white"
                placeholder="Enter your password"
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setSuccess("");
                }}
                className="text-sm font-medium text-gray-600 underline underline-offset-4 transition hover:text-black"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <p className="text-sm leading-6 text-gray-500">
              Enter your admin email address. We will send you a link to
              create a new password.
            </p>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Admin Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:bg-white"
                placeholder="admin@example.com"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm leading-6 text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
              className="w-full py-2 text-sm font-medium text-gray-500 transition hover:text-black"
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-gray-100 pt-6 text-center">
          <p className="text-xs tracking-wide text-gray-400">
            © 2026 DR. BRITNEY DENTAL CLINIC
          </p>
        </div>
      </div>
    </main>
  );
}
