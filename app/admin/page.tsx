
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Clock3,
  RefreshCw,
  Search,
  Mail,
  Activity,
  ArrowUpRight,
  Stethoscope,
  AlertCircle,
  Loader2,
} from "lucide-react";

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
  services: { name: string }[] | { name: string } | null;
};

type ServiceStat = {
  name: string;
  count: number;
};

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (date: string) => {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (time: string) => {
  if (!time) return "—";

  const [hours, minutes] = time.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getServiceName = (appointment: Appointment) => {
  if (Array.isArray(appointment.services)) {
    return appointment.services[0]?.name ?? "Unknown service";
  }

  return appointment.services?.name ?? "Unknown service";
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  confirmed: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  completed: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  cancelled: "bg-rose-400/10 text-rose-300 border-rose-400/20",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Accepted",
  completed: "Completed",
  cancelled: "Rejected",
};

export default function AdminDashboard() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [emailWarning, setEmailWarning] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const checkAdmin = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/admin/login");
      return false;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return false;
    }

    return true;
  }, [router, supabase]);

  const loadAppointments = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const isAdmin = await checkAdmin();

      if (!isAdmin) return;

      const { data, error: fetchError } = await supabase
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
          services ( name )
        `)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (fetchError) throw fetchError;

      setAppointments((data ?? []) as Appointment[]);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Unable to load appointments. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkAdmin, supabase]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const updateStatus = async (
    appointment: Appointment,
    newStatus: string
  ) => {
    setUpdatingId(appointment.id);
    setEmailWarning("");
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      setAppointments((previous) =>
        previous.map((item) =>
          item.id === appointment.id
            ? { ...item, status: newStatus }
            : item
        )
      );

      try {
        const response = await fetch("/api/send-appointment-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: appointment.email,
            patientName: appointment.patient_name,
            serviceName: getServiceName(appointment),
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            status: newStatus,
          }),
        });

        if (!response.ok) {
          setEmailWarning(
            "Appointment updated, but the email notification could not be sent."
          );
        }
      } catch {
        setEmailWarning(
          "Appointment updated, but the email notification could not be sent."
        );
      }
    } catch (err) {
      console.error("Status update error:", err);
      setError("Could not update appointment status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = useMemo(() => {
    const today = getLocalDateString();

    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === "pending").length;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const completed = appointments.filter((a) => a.status === "completed").length;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;

    const todayCount = appointments.filter(
      (a) => a.appointment_date === today
    ).length;

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 6);
    const lastWeekString = getLocalDateString(lastWeek);

    const last7Days = appointments.filter(
      (a) =>
        a.appointment_date >= lastWeekString &&
        a.appointment_date <= today
    ).length;

    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      todayCount,
      last7Days,
      completionRate,
    };
  }, [appointments]);

  const serviceStats = useMemo(() => {
    const counts: Record<string, number> = {};

    appointments.forEach((appointment) => {
      const name = getServiceName(appointment);
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [appointments]);

  const weeklyStats = useMemo(() => {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const dateString = getLocalDateString(date);

      const count = appointments.filter(
        (a) => a.appointment_date === dateString
      ).length;

      days.push({
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      });
    }

    return days;
  }, [appointments]);

  const maxWeeklyCount = Math.max(
    ...weeklyStats.map((day) => day.count),
    1
  );

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const matchesSearch =
        appointment.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        appointment.email.toLowerCase().includes(search.toLowerCase()) ||
        appointment.phone.includes(search);

      const matchesFilter =
        filter === "all" || appointment.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [appointments, search, filter]);

  const statusData = [
    {
      label: "Pending",
      count: stats.pending,
      color: "bg-amber-400",
      textColor: "text-amber-300",
    },
    {
      label: "Accepted",
      count: stats.confirmed,
      color: "bg-emerald-400",
      textColor: "text-emerald-300",
    },
    {
      label: "Completed",
      count: stats.completed,
      color: "bg-blue-400",
      textColor: "text-blue-300",
    },
    {
      label: "Rejected",
      count: stats.cancelled,
      color: "bg-rose-400",
      textColor: "text-rose-300",
    },
  ];

  const statCards = [
    {
      title: "Total Appointments",
      value: stats.total,
      subtitle: "All registered bookings",
      icon: CalendarDays,
      color: "text-cyan-300",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/15",
    },
    {
      title: "Today's Appointments",
      value: stats.todayCount,
      subtitle: "Scheduled for today",
      icon: CalendarCheck,
      color: "text-blue-300",
      bg: "bg-blue-400/10",
      border: "border-blue-400/15",
    },
    {
      title: "Pending Requests",
      value: stats.pending,
      subtitle: "Waiting for confirmation",
      icon: Clock3,
      color: "text-amber-300",
      bg: "bg-amber-400/10",
      border: "border-amber-400/15",
    },
    {
      title: "Completed",
      value: stats.completed,
      subtitle: "Successfully completed",
      icon: CheckCircle2,
      color: "text-emerald-300",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/15",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <AdminSidebar />

      <main className="min-h-screen p-5 pt-7 sm:p-8 lg:ml-64 lg:p-10">
        <div className="mx-auto max-w-[1500px]">

          {/* Header */}
          <header className="mb-9 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[2px] text-cyan-400">
                <Activity size={14} />
                Clinic Overview
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Dashboard
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Welcome back. Here&apos;s what&apos;s happening at your clinic.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#131f31] px-4 py-3 text-xs text-slate-300">
                <CalendarDays size={16} className="text-cyan-400" />
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>

              <button
                onClick={() => loadAppointments(true)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </header>

          {/* Alerts */}
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {emailWarning && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-300">
              <Mail size={18} />
              {emailWarning}
            </div>
          )}

          {/* Stats */}
          <section className="mb-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Overview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your clinic performance at a glance
                </p>
              </div>

              <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Live statistics
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.title}
                    className={`group relative overflow-hidden rounded-2xl border ${card.border} bg-[#131f31] p-5 transition duration-300 hover:-translate-y-1 hover:bg-[#18263b]`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-400">
                          {card.title}
                        </p>

                        <h3 className="mt-4 text-3xl font-extrabold tracking-tight">
                          {loading ? "—" : card.value}
                        </h3>

                        <p className="mt-2 text-[11px] text-slate-500">
                          {card.subtitle}
                        </p>
                      </div>

                      <div className={`rounded-xl p-3 ${card.bg}`}>
                        <Icon size={22} className={card.color} />
                      </div>
                    </div>

                    <div className="absolute -bottom-9 -right-8 h-24 w-24 rounded-full bg-cyan-400/[0.04] blur-2xl transition group-hover:bg-cyan-400/[0.10]" />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Secondary stats */}
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#131f31] p-5">
              <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Last 7 Days</p>
                <p className="mt-1 text-2xl font-bold">
                  {loading ? "—" : stats.last7Days}
                </p>
              </div>
              <ArrowUpRight className="ml-auto text-violet-300" size={18} />
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#131f31] p-5">
              <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Completion Rate</p>
                <p className="mt-1 text-2xl font-bold">
                  {loading ? "—" : `${stats.completionRate}%`}
                </p>
              </div>
              <span className="ml-auto text-xs text-emerald-300">Rate</span>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#131f31] p-5">
              <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Accepted Appointments</p>
                <p className="mt-1 text-2xl font-bold">
                  {loading ? "—" : stats.confirmed}
                </p>
              </div>
              <span className="ml-auto text-xs text-cyan-300">Confirmed</span>
            </div>
          </section>

          {/* Analytics */}
          <section className="mb-8 grid gap-5 xl:grid-cols-2">

            {/* Weekly chart */}
            <div className="rounded-2xl border border-white/10 bg-[#131f31] p-6">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Weekly Activity</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Appointments over the last 7 days
                  </p>
                </div>

                <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="flex h-48 items-end justify-between gap-3">
                {weeklyStats.map((day) => {
                  const height =
                    day.count === 0
                      ? 4
                      : Math.max((day.count / maxWeeklyCount) * 100, 8);

                  return (
                    <div
                      key={day.label}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                    >
                      <span className="text-[10px] font-bold text-slate-400">
                        {day.count}
                      </span>

                      <div className="flex h-32 w-full items-end justify-center rounded-t-lg bg-white/[0.025]">
                        <div
                          className="w-full max-w-9 rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-300 transition-all duration-500"
                          style={{ height: `${height}%` }}
                        />
                      </div>

                      <span className="text-[10px] font-semibold text-slate-500">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status chart */}
            <div className="rounded-2xl border border-white/10 bg-[#131f31] p-6">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Appointment Status</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Distribution of all appointments
                  </p>
                </div>

                <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                  <Activity size={20} />
                </div>
              </div>

              <div className="mb-7">
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-xs text-slate-400">
                    Total appointments
                  </span>
                  <span className="text-2xl font-extrabold">
                    {loading ? "—" : stats.total}
                  </span>
                </div>

                <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
                  {statusData.map((item) => (
                    <div
                      key={item.label}
                      className={`${item.color} transition-all duration-500`}
                      style={{
                        width:
                          stats.total > 0
                            ? `${(item.count / stats.total) * 100}%`
                            : "0%",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {statusData.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-white/[0.025] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs text-slate-400">
                        {item.label}
                      </span>
                    </div>

                    <span className={`text-sm font-bold ${item.textColor}`}>
                      {loading ? "—" : item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Services */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-[#131f31] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Popular Services</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Most requested clinic services
                </p>
              </div>

              <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                <Stethoscope size={20} />
              </div>
            </div>

            {serviceStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No service data available yet.
              </p>
            ) : (
              <div className="space-y-5">
                {serviceStats.map((service, index) => {
                  const maxCount = serviceStats[0]?.count || 1;
                  const percentage = (service.count / maxCount) * 100;

                  return (
                    <div key={service.name}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-cyan-300">
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-200">
                            {service.name}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-slate-400">
                          {service.count} bookings
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-300 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Appointments */}
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#131f31]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-6 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-bold">Recent Appointments</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Review and manage patient bookings
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search patients..."
                    className="w-full rounded-xl border border-white/10 bg-[#0b1220] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 sm:w-52"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-cyan-400/50"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Accepted</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Rejected</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 size={30} className="mb-3 animate-spin text-cyan-400" />
                <p className="text-sm">Loading appointments...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <CalendarDays size={35} className="mb-3 opacity-40" />
                <p className="text-sm font-semibold">No appointments found</p>
                <p className="mt-1 text-xs">
                  Try changing your search or filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-bold">Patient</th>
                      <th className="px-6 py-4 font-bold">Service</th>
                      <th className="px-6 py-4 font-bold">Date & Time</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredAppointments.map((appointment) => (
                      <tr
                        key={appointment.id}
                        className="transition hover:bg-white/[0.025]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-bold text-cyan-300">
                              {appointment.patient_name?.charAt(0)?.toUpperCase() || "P"}
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">
                                {appointment.patient_name}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {appointment.email}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {appointment.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-300">
                            {getServiceName(appointment)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-xs font-semibold text-slate-200">
                            {formatDate(appointment.appointment_date)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatTime(appointment.appointment_time)}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
                              statusStyles[appointment.status] ||
                              "border-white/10 bg-white/5 text-slate-300"
                            }`}
                          >
                            {statusLabels[appointment.status] || appointment.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {appointment.status === "pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateStatus(appointment, "confirmed")
                                  }
                                  disabled={updatingId === appointment.id}
                                  className="rounded-lg bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-40"
                                >
                                  Accept
                                </button>

                                <button
                                  onClick={() =>
                                    updateStatus(appointment, "cancelled")
                                  }
                                  disabled={updatingId === appointment.id}
                                  className="rounded-lg bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-40"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {appointment.status === "confirmed" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateStatus(appointment, "completed")
                                  }
                                  disabled={updatingId === appointment.id}
                                  className="rounded-lg bg-blue-400/10 px-3 py-2 text-[10px] font-bold text-blue-300 transition hover:bg-blue-400/20 disabled:opacity-40"
                                >
                                  Complete
                                </button>

                                <button
                                  onClick={() =>
                                    updateStatus(appointment, "cancelled")
                                  }
                                  disabled={updatingId === appointment.id}
                                  className="rounded-lg bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-40"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {updatingId === appointment.id && (
                              <Loader2
                                size={15}
                                className="animate-spin text-cyan-300"
                              />
                            )}

                            {(appointment.status === "completed" ||
                              appointment.status === "cancelled") && (
                              <span className="text-[10px] text-slate-600">
                                No actions
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col justify-between gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center">
              <p className="text-[11px] text-slate-500">
                Showing {filteredAppointments.length} of {appointments.length} appointments
              </p>

              <button
                onClick={() => router.push("/admin/pending")}
                className="flex items-center gap-2 text-xs font-bold text-cyan-300 transition hover:text-cyan-200"
              >
                View pending appointments
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-5 text-[10px] text-slate-600 sm:flex-row">
            <p>© 2026 DR. BRITNEY Dental Clinic. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Admin Dashboard
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
