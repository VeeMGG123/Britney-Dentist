"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/app/admin/components/adminsidebar";

type Appointment = {
  id: number;
  patient_name: string;
  phone: string;
  email: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_id: number | null;
  services: { name: string }[] | null;
};

export default function CompletedPage() {
  const router = useRouter();
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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

    await loadAppointments();
  }

  async function loadAppointments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        patient_name,
        phone,
        email,
        appointment_date,
        appointment_time,
        status,
        service_id,
        services (
          name
        )
      `)
      .eq("status", "completed")
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

    if (error) {
      console.error(
        "Error loading completed appointments:",
        error
      );
      setAppointments([]);
    } else {
      setAppointments(
        (data || []) as unknown as Appointment[]
      );
    }

    setLoading(false);
  }

  function formatDate(date: string) {
    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

            <p className="mb-2 text-sm font-medium text-blue-600">
              APPOINTMENTS
            </p>

            <h2 className="text-3xl font-bold tracking-tight">
              Completed Appointments
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              All appointments that have been completed.
            </p>

          </div>

          <div className="flex items-center gap-4">

            <button
              onClick={loadAppointments}
              disabled={loading}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Completed
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {appointments.length}
              </p>

            </div>

          </div>

        </div>

        {/* Table Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          {loading ? (

            <div className="flex min-h-[300px] items-center justify-center">

              <div className="text-sm text-gray-500">
                Loading completed appointments...
              </div>

            </div>

          ) : appointments.length === 0 ? (

            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
                ✓
              </div>

              <h3 className="text-lg font-semibold text-gray-900">
                No completed appointments
              </h3>

              <p className="mt-2 max-w-md text-sm text-gray-500">
                When an accepted appointment is marked as
                completed, it will appear here.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead>

                  <tr className="border-b border-gray-200 bg-gray-50">

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Patient
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Phone
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Service
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Time
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {appointments.map((appointment) => (

                    <tr
                      key={appointment.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >

                      {/* Patient */}
                      <td className="px-6 py-5">

                        <div className="font-semibold text-gray-900">
                          {appointment.patient_name}
                        </div>

                      </td>

                      {/* Phone */}
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {appointment.phone}
                      </td>

                      {/* Email */}
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {appointment.email}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {appointment.services?.[0]?.name || "—"}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-5 text-sm text-gray-600">
                        {formatDate(
                          appointment.appointment_date
                        )}
                      </td>

                      {/* Time */}
                      <td className="px-6 py-5 text-sm font-medium text-gray-900">
                        {appointment.appointment_time}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">

                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          Completed
                        </span>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </main>

    </div>
  );
}