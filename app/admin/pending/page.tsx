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
  services:
    | {
        name: string;
      }[]
    | null;
};

export default function PendingAppointmentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

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
      .eq("status", "pending")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) {
      console.error("Error loading appointments:", error);
      setAppointments([]);
    } else {
      setAppointments((data || []) as unknown as Appointment[]);
    }

    setLoading(false);
  }

  async function updateStatus(
    appointment: Appointment,
    newStatus: "confirmed" | "cancelled"
  ) {
    setUpdating(appointment.id);

    const { error } = await supabase
      .from("appointments")
      .update({
        status: newStatus,
      })
      .eq("id", appointment.id);

    if (error) {
      console.error("Error updating appointment:", error);
      alert("Failed to update appointment.");
      setUpdating(null);
      return;
    }

    try {
      await fetch("/api/send-appointment-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: appointment.email,
          patientName: appointment.patient_name,
          serviceName:
            appointment.services?.[0]?.name ||
            "Dental Appointment",
          appointmentDate: appointment.appointment_date,
          appointmentTime: appointment.appointment_time,
          status: newStatus,
        }),
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
    }

    await loadAppointments();
    setUpdating(null);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-900">

      {/* Shared Admin Sidebar */}
      <AdminSidebar />

      <main className="ml-64 p-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">

          <div>
            <h2 className="text-3xl font-bold">
              Pending Appointments
            </h2>

            <p className="mt-2 text-gray-500">
              Review and manage new appointment requests.
            </p>
          </div>

          <button
            onClick={loadAppointments}
            disabled={loading}
            className="rounded-lg border bg-white px-5 py-3 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

        </div>

        {/* Loading */}
        {loading ? (
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
            <p className="text-gray-500">
              Loading appointments...
            </p>
          </div>

        ) : appointments.length === 0 ? (

          /* Empty State */
          <div className="rounded-xl border bg-white p-10 text-center shadow-sm">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
              ✓
            </div>

            <h3 className="mt-5 text-xl font-semibold">
              No pending appointments
            </h3>

            <p className="mt-2 text-gray-500">
              New booking requests will appear here.
            </p>

          </div>

        ) : (

          /* Appointments Table */
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="border-b bg-gray-50">

                  <tr>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Patient
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Phone
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Service
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Date
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Time
                    </th>

                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {appointments.map((appointment) => (

                    <tr
                      key={appointment.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >

                      {/* Patient */}
                      <td className="px-6 py-5">

                        <div className="font-semibold text-gray-900">
                          {appointment.patient_name}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          {appointment.email}
                        </div>

                      </td>

                      {/* Phone */}
                      <td className="px-6 py-5 text-sm">
                        {appointment.phone}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-5 text-sm">
                        {appointment.services?.[0]?.name ||
                          "Dental Appointment"}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-5 text-sm">
                        {appointment.appointment_date}
                      </td>

                      {/* Time */}
                      <td className="px-6 py-5 text-sm">
                        {appointment.appointment_time}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5">

                        <div className="flex gap-2">

                          {/* Approve */}
                          <button
                            disabled={
                              updating === appointment.id
                            }
                            onClick={() =>
                              updateStatus(
                                appointment,
                                "confirmed"
                              )
                            }
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updating === appointment.id
                              ? "..."
                              : "Approve"}
                          </button>

                          {/* Reject */}
                          <button
                            disabled={
                              updating === appointment.id
                            }
                            onClick={() =>
                              updateStatus(
                                appointment,
                                "cancelled"
                              )
                            }
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </main>

    </div>
  );
}