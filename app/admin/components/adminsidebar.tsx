"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [pending, setPending] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [cancelled, setCancelled] = useState(0);

  useEffect(() => {
    loadAppointmentCounts();

    // Refresh counts whenever the user comes back to the page
    const interval = setInterval(() => {
      loadAppointmentCounts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function loadAppointmentCounts() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // Check admin
      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!admin) {
        return;
      }

      // Pending
      const { count: pendingCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Confirmed / Accepted
      const { count: confirmedCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed");

      // Completed
      const { count: completedCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed");

      // Cancelled / Rejected
      const { count: cancelledCount } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled");

      setPending(pendingCount || 0);
      setConfirmed(confirmedCount || 0);
      setCompleted(completedCount || 0);
      setCancelled(cancelledCount || 0);
    } catch (error) {
      console.error("Error loading sidebar counts:", error);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const navItems = [
    {
      name: "Dashboard",
      path: "/admin",
      count: null,
    },
    {
      name: "Pending",
      path: "/admin/pending",
      count: pending,
    },
    {
      name: "Accepted",
      path: "/admin/accepted",
      count: confirmed,
    },
    {
      name: "Completed",
      path: "/admin/completed",
      count: completed,
    },
    {
      name: "Rejected",
      path: "/admin/rejected",
      count: cancelled,
    },
    {
      name: "Reviews",
      path: "/admin/reviews",
      count: null,
    },
    {
      name: "Working Hours",
      path: "/admin/working-hours",
      count: null,
    },
  ];

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-gray-200 bg-white p-6">

      {/* Doctor Name */}
      <h1 className="mb-10 text-2xl font-bold tracking-tight text-gray-900">
        DR. BRITNEY
      </h1>

      {/* Navigation */}
      <nav className="space-y-2">

        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition ${
                active
                  ? "bg-gray-100 font-semibold text-gray-900"
                  : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span>{item.name}</span>

              {item.count !== null && item.count > 0 && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    item.name === "Pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : item.name === "Accepted"
                      ? "bg-green-100 text-green-700"
                      : item.name === "Completed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        className="mt-auto w-full rounded-lg border border-gray-200 px-4 py-3 text-left font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
      >
        Logout
      </button>

    </aside>
  );
}