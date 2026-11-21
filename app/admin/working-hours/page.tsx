"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/app/admin/components/adminsidebar";

type WorkingHour = {
  id: number;
  day_of_week: number;
  day_name: string;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

export default function WorkingHoursPage() {
  const router = useRouter();
  const supabase = createClient();

  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !admin) {
      router.replace("/admin/login");
      return;
    }

    await loadWorkingHours();
  }

  async function loadWorkingHours() {
    setLoading(true);

    const { data, error } = await supabase
      .from("working_hours")
      .select(`
        id,
        day_of_week,
        day_name,
        is_open,
        start_time,
        end_time,
        slot_duration
      `)
      .order("day_of_week", { ascending: true });

    if (error) {
      console.error("Error loading working hours:", error);
      alert("Failed to load working hours.");
      setWorkingHours([]);
    } else {
      setWorkingHours((data || []) as WorkingHour[]);
    }

    setLoading(false);
  }

  function updateLocal(
    id: number,
    field: keyof WorkingHour,
    value: string | boolean | number
  ) {
    setWorkingHours((current) =>
      current.map((day) =>
        day.id === id
          ? {
              ...day,
              [field]: value,
            }
          : day
      )
    );
  }

  async function saveDay(day: WorkingHour) {
    setSaving(day.id);

    const { error } = await supabase
      .from("working_hours")
      .update({
        is_open: day.is_open,
        start_time: day.start_time,
        end_time: day.end_time,
        slot_duration: day.slot_duration,
      })
      .eq("id", day.id);

    if (error) {
      console.error("Error saving working hours:", error);
      alert("Failed to save working hours.");
    } else {
      alert(`${day.day_name} saved successfully.`);
    }

    setSaving(null);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-900">

      {/* Shared Admin Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="ml-64 p-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">

          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">
              CLINIC SETTINGS
            </p>

            <h2 className="text-3xl font-bold tracking-tight">
              Working Hours
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Manage clinic working days, opening hours and appointment
              slot duration.
            </p>
          </div>

          <button
            onClick={loadWorkingHours}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

        </div>

        {/* Loading */}
        {loading ? (

          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">

            <p className="text-sm text-gray-500">
              Loading working hours...
            </p>

          </div>

        ) : workingHours.length === 0 ? (

          /* Empty */
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
              🕒
            </div>

            <h3 className="mt-4 text-xl font-semibold">
              No working hours found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Working hours have not been configured yet.
            </p>

          </div>

        ) : (

          /* Working Hours */
          <div className="space-y-4">

            {workingHours.map((day) => (

              <div
                key={day.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >

                <div className="grid items-end gap-5 md:grid-cols-[160px_120px_1fr_1fr_170px_120px]">

                  {/* Day */}
                  <div className="self-center">

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Day
                    </p>

                    <h3 className="mt-1 text-lg font-semibold text-gray-900">
                      {day.day_name}
                    </h3>

                  </div>

                  {/* Open / Closed */}
                  <label className="flex cursor-pointer items-center gap-3 self-center">

                    <input
                      type="checkbox"
                      checked={day.is_open}
                      onChange={(e) =>
                        updateLocal(
                          day.id,
                          "is_open",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />

                    <span
                      className={`text-sm font-medium ${
                        day.is_open
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {day.is_open ? "Open" : "Closed"}
                    </span>

                  </label>

                  {/* Start */}
                  <div>

                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                      Start
                    </label>

                    <input
                      type="time"
                      value={day.start_time?.slice(0, 5) || ""}
                      disabled={!day.is_open}
                      onChange={(e) =>
                        updateLocal(
                          day.id,
                          "start_time",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />

                  </div>

                  {/* End */}
                  <div>

                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                      End
                    </label>

                    <input
                      type="time"
                      value={day.end_time?.slice(0, 5) || ""}
                      disabled={!day.is_open}
                      onChange={(e) =>
                        updateLocal(
                          day.id,
                          "end_time",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />

                  </div>

                  {/* Slot Duration */}
                  <div>

                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                      Slot Duration
                    </label>

                    <select
                      value={day.slot_duration}
                      disabled={!day.is_open}
                      onChange={(e) =>
                        updateLocal(
                          day.id,
                          "slot_duration",
                          Number(e.target.value)
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>

                  </div>

                  {/* Save */}
                  <button
                    onClick={() => saveDay(day)}
                    disabled={saving === day.id}
                    className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving === day.id ? "Saving..." : "Save"}
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </main>
    </div>
  );
}