
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Clock,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  MessageSquare,
  LogOut,
  Stethoscope,
  ChevronRight,
} from "lucide-react";

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [cancelled, setCancelled] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadAppointmentCounts = useCallback(async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!admin) return;

      const getCount = async (status: string) => {
        const { count, error } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", status);

        if (error) throw error;
        return count ?? 0;
      };

      const [p, c, d, x] = await Promise.all([
        getCount("pending"),
        getCount("confirmed"),
        getCount("completed"),
        getCount("cancelled"),
      ]);

      setPending(p);
      setConfirmed(c);
      setCompleted(d);
      setCancelled(x);
    } catch (error) {
      console.error("Sidebar counts error:", error);
    }
  }, []);

  useEffect(() => {
    loadAppointmentCounts();

    const interval = setInterval(loadAppointmentCounts, 10000);

    return () => clearInterval(interval);
  }, [loadAppointmentCounts]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  }

  const navItems = [
    {
      name: "Dashboard",
      path: "/admin",
      icon: LayoutDashboard,
      count: null,
      color: "text-cyan-400",
    },
    {
      name: "Pending Appointments",
      path: "/admin/pending",
      icon: CalendarClock,
      count: pending,
      color: "text-amber-400",
    },
    {
      name: "Accepted Appointments",
      path: "/admin/accepted",
      icon: CalendarCheck,
      count: confirmed,
      color: "text-emerald-400",
    },
    {
      name: "Completed",
      path: "/admin/completed",
      icon: CheckCircle2,
      count: completed,
      color: "text-blue-400",
    },
    {
      name: "Rejected",
      path: "/admin/rejected",
      icon: CalendarX,
      count: cancelled,
      color: "text-rose-400",
    },
    {
      name: "Reviews",
      path: "/admin/reviews",
      icon: MessageSquare,
      count: null,
      color: "text-violet-400",
    },
    {
      name: "Working Hours",
      path: "/admin/working-hours",
      icon: Clock,
      count: null,
      color: "text-teal-400",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col overflow-y-auto border-r border-white/10 bg-[#101827] text-white shadow-2xl">

      {/* Brand */}
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>

          <div>
            <h1 className="text-lg font-extrabold tracking-wide">
              DR. BRITNEY
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">
              Dental Clinic
            </p>
          </div>
        </div>
      </div>

      {/* Admin profile */}
      <div className="mx-4 mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
            <Stethoscope size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-white">
              Admin Panel
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Manage your clinic
            </p>
          </div>

          <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 pt-8">
        <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">
          Main Menu
        </p>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-white shadow-inner ring-1 ring-cyan-400/20"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon
                  size={19}
                  className={`shrink-0 transition-colors ${
                    active ? "text-cyan-300" : `${item.color} opacity-80`
                  }`}
                />

                <span className="flex-1 text-[13px] font-semibold">
                  {item.name}
                </span>

                {item.count !== null && item.count > 0 && (
                  <span
                    className={`min-w-6 rounded-lg px-2 py-1 text-center text-[10px] font-bold ${
                      active
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-white/10 text-slate-200"
                    }`}
                  >
                    {item.count}
                  </span>
                )}

                {active && (
                  <ChevronRight size={15} className="text-cyan-300" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="mt-auto p-4">
        <div className="mb-4 rounded-xl border border-cyan-400/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-4">
          <p className="text-xs font-semibold text-cyan-300">
            Clinic Management
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Keep track of appointments and manage your clinic efficiently.
          </p>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-4 py-3 text-sm font-semibold text-rose-300 transition-all hover:border-rose-400/30 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={18} />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>

        <p className="mt-5 text-center text-[10px] tracking-wide text-slate-600">
          DR. BRITNEY © 2026
        </p>
      </div>
    </aside>
  );
}
