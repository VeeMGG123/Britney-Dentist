"use client";

import { useEffect, useMemo, useState } from "react";
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

type DailyBooking = {
  date: string;
  label: string;
  count: number;
};

export default function AdminDashboard() {
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
    newStatus: "confirmed" | "cancelled" | "completed"
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

  /*
   * ============================
   * BASIC STATISTICS
   * ============================
   */

  const total = appointments.length;

  const pending = appointments.filter(
    (appointment) => appointment.status === "pending"
  ).length;

  const confirmed = appointments.filter(
    (appointment) => appointment.status === "confirmed"
  ).length;

  const completed = appointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;

  const cancelled = appointments.filter(
    (appointment) => appointment.status === "cancelled"
  ).length;

  /*
   * ============================
   * DATE HELPERS
   * ============================
   */

  function getLocalDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatShortDate(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  /*
   * ============================
   * TODAY
   * ============================
   */

  const today = getLocalDateString(new Date());

  const todayAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_date === today
  );

  const todayCount = todayAppointments.length;

  /*
   * ============================
   * LAST 7 DAYS
   * ============================
   */

  const last7Days = useMemo<DailyBooking[]>(() => {
    const result: DailyBooking[] = [];

    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);

      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - i);

      const dateString = getLocalDateString(date);

      const count = appointments.filter(
        (appointment) =>
          appointment.appointment_date === dateString
      ).length;

      result.push({
        date: dateString,
        label: date.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        count,
      });
    }

    return result;
  }, [appointments]);

  const last7DaysTotal = last7Days.reduce(
    (sum, day) => sum + day.count,
    0
  );

  const maxDailyBookings = Math.max(
    ...last7Days.map((day) => day.count),
    1
  );

  /*
   * ============================
   * COMPLETION RATE
   * ============================
   */

  const completionRate =
    total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  /*
   * ============================
   * SERVICE ANALYTICS
   * ============================
   */

  const serviceStats = useMemo(() => {
    const counts: Record<string, number> = {};

    appointments.forEach((appointment) => {
      const serviceName =
        appointment.services?.[0]?.name ||
        "Dental Appointment";

      counts[serviceName] =
        (counts[serviceName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [appointments]);

  const topService = serviceStats[0];

  const maxServiceBookings = Math.max(
    ...serviceStats.map((service) => service.count),
    1
  );

  /*
   * ============================
   * STATUS PERCENTAGES
   * ============================
   */

  const pendingPercentage =
    total > 0
      ? Math.round((pending / total) * 100)
      : 0;

  const confirmedPercentage =
    total > 0
      ? Math.round((confirmed / total) * 100)
      : 0;

  const completedPercentage =
    total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  const cancelledPercentage =
    total > 0
      ? Math.round((cancelled / total) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-900">

      {/* =========================
          SHARED SIDEBAR
      ========================== */}

     <AdminSidebar />

      {/* =========================
          MAIN
      ========================== */}

      <main className="ml-64 p-10">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">

          <div>
            <h2 className="text-3xl font-bold">
              Dashboard
            </h2>

            <p className="mt-2 text-gray-500">
              Manage your dental clinic appointments.
            </p>
          </div>

          <button
            onClick={loadAppointments}
            disabled={loading}
            className="rounded-lg border bg-white px-5 py-3 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

        </div>

        {/* =========================
            MAIN STATISTICS
        ========================== */}

        <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">

          {/* Total */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Bookings
            </p>

            <p className="mt-2 text-3xl font-bold">
              {total}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              All appointments
            </p>
          </div>

          {/* Pending */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {pending}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Waiting for approval
            </p>
          </div>

          {/* Accepted */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Accepted
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {confirmed}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Confirmed appointments
            </p>
          </div>

          {/* Completed */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Completed
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {completed}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Finished appointments
            </p>
          </div>

          {/* Rejected */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Rejected
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {cancelled}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Cancelled appointments
            </p>
          </div>

        </div>

        {/* =========================
            ADVANCED ANALYTICS
        ========================== */}

        <div className="mb-10 grid gap-6 lg:grid-cols-3">

          {/* Today */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-gray-500">
                  Today
                </p>

                <h3 className="mt-2 text-4xl font-bold">
                  {todayCount}
                </h3>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl">
                📅
              </div>

            </div>

            <p className="mt-4 text-sm text-gray-400">
              Appointments scheduled today
            </p>

          </div>

          {/* Last 7 Days */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-gray-500">
                  Last 7 Days
                </p>

                <h3 className="mt-2 text-4xl font-bold">
                  {last7DaysTotal}
                </h3>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-xl">
                📈
              </div>

            </div>

            <p className="mt-4 text-sm text-gray-400">
              Appointments during the last 7 days
            </p>

          </div>

          {/* Completion Rate */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-gray-500">
                  Completion Rate
                </p>

                <h3 className="mt-2 text-4xl font-bold">
                  {completionRate}%
                </h3>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl">
                ✓
              </div>

            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">

              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${completionRate}%`,
                }}
              />

            </div>

            <p className="mt-3 text-sm text-gray-400">
              Completed appointments vs all bookings
            </p>

          </div>

        </div>

        {/* =========================
            CHARTS
        ========================== */}

        <div className="mb-10 grid gap-6 lg:grid-cols-2">

          {/* Booking Activity */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">

            <div className="mb-8">

              <h3 className="text-xl font-semibold">
                Booking Activity
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Appointments during the last 7 days
              </p>

            </div>

            <div className="flex h-64 items-end justify-between gap-3">

              {last7Days.map((day) => {

                const height =
                  day.count === 0
                    ? 5
                    : Math.max(
                        12,
                        (day.count /
                          maxDailyBookings) *
                          100
                      );

                return (
                  <div
                    key={day.date}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >

                    <div className="mb-2 text-xs font-semibold text-gray-500">
                      {day.count}
                    </div>

                    <div className="flex h-44 w-full items-end justify-center">

                      <div
                        className="w-full max-w-[42px] rounded-t-xl bg-gray-900 transition-all duration-500"
                        style={{
                          height: `${height}%`,
                        }}
                        title={`${day.count} bookings`}
                      />

                    </div>

                    <div className="mt-3 text-xs font-medium text-gray-400">
                      {day.label}
                    </div>

                    <div className="mt-1 text-[10px] text-gray-300">
                      {formatShortDate(day.date)}
                    </div>

                  </div>
                );
              })}

            </div>

          </div>

          {/* Status Distribution */}
          <div className="rounded-2xl border bg-white p-7 shadow-sm">

            <div className="mb-8">

              <h3 className="text-xl font-semibold">
                Booking Status
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Distribution of all appointments
              </p>

            </div>

            <div className="space-y-6">

              {/* Pending */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-sm font-medium">
                    Pending
                  </span>

                  <span className="text-sm text-gray-500">
                    {pending} ({pendingPercentage}%)
                  </span>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">

                  <div
                    className="h-full rounded-full bg-yellow-400"
                    style={{
                      width: `${pendingPercentage}%`,
                    }}
                  />

                </div>

              </div>

              {/* Accepted */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-sm font-medium">
                    Accepted
                  </span>

                  <span className="text-sm text-gray-500">
                    {confirmed} ({confirmedPercentage}%)
                  </span>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">

                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${confirmedPercentage}%`,
                    }}
                  />

                </div>

              </div>

              {/* Completed */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-sm font-medium">
                    Completed
                  </span>

                  <span className="text-sm text-gray-500">
                    {completed} ({completedPercentage}%)
                  </span>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">

                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${completedPercentage}%`,
                    }}
                  />

                </div>

              </div>

              {/* Cancelled */}
              <div>

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-sm font-medium">
                    Cancelled
                  </span>

                  <span className="text-sm text-gray-500">
                    {cancelled} ({cancelledPercentage}%)
                  </span>

                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">

                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${cancelledPercentage}%`,
                    }}
                  />

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =========================
            TOP SERVICES
        ========================== */}

        <div className="mb-10 rounded-2xl border bg-white p-7 shadow-sm">

          <div className="mb-8">

            <h3 className="text-xl font-semibold">
              Most Requested Services
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Services ranked by number of bookings
            </p>

          </div>

          {serviceStats.length === 0 ? (

            <div className="py-10 text-center text-sm text-gray-400">
              No service data available yet.
            </div>

          ) : (

            <div className="space-y-6">

              {serviceStats
                .slice(0, 5)
                .map((service, index) => {

                  const width =
                    (service.count /
                      maxServiceBookings) *
                    100;

                  return (
                    <div key={service.name}>

                      <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-3">

                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                            {index + 1}
                          </span>

                          <span className="text-sm font-medium">
                            {service.name}
                          </span>

                        </div>

                        <span className="text-sm font-semibold text-gray-500">
                          {service.count} bookings
                        </span>

                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-gray-100">

                        <div
                          className="h-full rounded-full bg-gray-900 transition-all duration-500"
                          style={{
                            width: `${width}%`,
                          }}
                        />

                      </div>

                    </div>
                  );
                })}

            </div>

          )}

        </div>

        {/* =========================
            TOP SERVICE
        ========================== */}

        {topService && (
          <div className="mb-10 rounded-2xl border bg-gray-900 p-8 text-white shadow-sm">

            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

              <div>

                <p className="text-sm text-white/50">
                  Most Requested Service
                </p>

                <h3 className="mt-2 text-3xl font-bold">
                  {topService.name}
                </h3>

                <p className="mt-2 text-sm text-white/50">
                  This service has the highest number of
                  appointments.
                </p>

              </div>

              <div className="text-left md:text-right">

                <div className="text-5xl font-bold">
                  {topService.count}
                </div>

                <div className="mt-1 text-sm text-white/50">
                  total bookings
                </div>

              </div>

            </div>

          </div>
        )}

        {/* =========================
            APPOINTMENTS
        ========================== */}

        <div className="rounded-xl border bg-white">

          <div className="flex items-center justify-between border-b p-6">

            <div>

              <h3 className="text-xl font-semibold">
                Appointments
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Manage all appointment requests.
              </p>

            </div>

          </div>

          {loading ? (

            <div className="p-10 text-center text-gray-500">
              Loading appointments...
            </div>

          ) : appointments.length === 0 ? (

            <div className="p-10 text-center">

              <h4 className="text-lg font-semibold">
                No appointments
              </h4>

              <p className="mt-2 text-gray-500">
                New appointments will appear here.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="border-b bg-gray-50">

                  <tr>

                    <th className="px-6 py-4 text-left">
                      Patient
                    </th>

                    <th className="px-6 py-4 text-left">
                      Phone
                    </th>

                    <th className="px-6 py-4 text-left">
                      Service
                    </th>

                    <th className="px-6 py-4 text-left">
                      Date
                    </th>

                    <th className="px-6 py-4 text-left">
                      Time
                    </th>

                    <th className="px-6 py-4 text-left">
                      Status
                    </th>

                    <th className="px-6 py-4 text-left">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {appointments.map((appointment) => (

                    <tr
                      key={appointment.id}
                      className="border-b last:border-0"
                    >

                      {/* Patient */}
                      <td className="px-6 py-5">

                        <div className="font-semibold">
                          {appointment.patient_name}
                        </div>

                        <div className="text-sm text-gray-500">
                          {appointment.email}
                        </div>

                      </td>

                      {/* Phone */}
                      <td className="px-6 py-5">
                        {appointment.phone}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-5">
                        {appointment.services?.[0]?.name ||
                          "Dental Appointment"}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-5">
                        {appointment.appointment_date}
                      </td>

                      {/* Time */}
                      <td className="px-6 py-5">
                        {appointment.appointment_time}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            appointment.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : appointment.status ===
                                "confirmed"
                              ? "bg-green-100 text-green-700"
                              : appointment.status ===
                                "completed"
                              ? "bg-blue-100 text-blue-700"
                              : appointment.status ===
                                "cancelled"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {appointment.status === "confirmed"
                            ? "Accepted"
                            : appointment.status ===
                              "cancelled"
                            ? "Cancelled"
                            : appointment.status ===
                              "completed"
                            ? "Completed"
                            : "Pending"}
                        </span>

                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5">

                        {/* Pending */}
                        {appointment.status === "pending" && (

                          <div className="flex gap-2">

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
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {updating === appointment.id
                                ? "..."
                                : "Approve"}
                            </button>

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
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>

                          </div>

                        )}

                        {/* Accepted */}
                        {appointment.status === "confirmed" && (

                          <div className="flex gap-2">

                            <button
                              disabled={
                                updating === appointment.id
                              }
                              onClick={() =>
                                updateStatus(
                                  appointment,
                                  "completed"
                                )
                              }
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {updating === appointment.id
                                ? "..."
                                : "Completed"}
                            </button>

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
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Cancelled
                            </button>

                          </div>

                        )}

                        {/* Completed */}
                        {appointment.status === "completed" && (

                          <button
                            onClick={() =>
                              router.push("/admin/completed")
                            }
                            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                          >
                            View Completed
                          </button>

                        )}

                        {/* Cancelled */}
                        {appointment.status === "cancelled" && (

                          <button
                            onClick={() =>
                              router.push("/admin/rejected")
                            }
                            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                          >
                            View Rejected
                          </button>

                        )}

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