"use client";

import {
  motion,
  useInView,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Service = {
  id: number;
  name: string;
  description?: string | null;
  price?: number | string | null;
  duration?: number | null;
};

type WorkingHour = {
  id: number;
  day_of_week: number;
  day_name: string;
  is_open: boolean;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

type BookedTimeRow = {
  appointment_time: string | null;
};

type Review = {
  id: number;
  patient_name: string;
  rating: number;
  comment: string;
  created_at: string | null;
};

const faqs = [
  {
    question: "HOW DO I BOOK AN APPOINTMENT?",
    answer:
      "Choose your preferred service and date in the booking section. Our team will confirm your appointment shortly after.",
  },
  {
    question: "DO YOU OFFER A FIRST CONSULTATION?",
    answer:
      "Yes. Your first visit includes a detailed consultation so we can understand your needs and recommend the right treatment.",
  },
  {
    question: "HOW LONG DOES A SMILE DESIGN TAKE?",
    answer:
      "Treatment time depends on your individual case. During your consultation, the doctor will explain the expected timeline clearly.",
  },
  {
    question: "DO YOU ACCEPT EMERGENCY CASES?",
    answer:
      "Yes. Contact the clinic directly and our team will do their best to arrange the earliest available appointment.",
  },
];

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 45 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <Reveal>
      <div className="border-l border-[#173c3b]/20 pl-5">
        <div className="text-5xl font-medium tracking-[-0.06em] text-[#123d3b] md:text-6xl">
          {number}
        </div>

        <div className="mt-2 text-[10px] font-semibold tracking-[0.2em] text-[#123d3b]/50">
          {label}
        </div>
      </div>
    </Reveal>
  );
}

function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number
) {
  const slots: string[] = [];

  if (!startTime || !endTime || !duration || duration <= 0) {
    return slots;
  }

  const [startHour, startMinute] = startTime
    .slice(0, 5)
    .split(":")
    .map(Number);

  const [endHour, endMinute] = endTime
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return slots;
  }

  let currentMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  while (currentMinutes + duration <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;

    slots.push(
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`
    );

    currentMinutes += duration;
  }

  return slots;
}

function formatTime(time: string) {
  const [hoursString, minutesString] = time.slice(0, 5).split(":");

  const hours = Number(hoursString);
  const minutes = Number(minutesString);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")} ${period}`;
}

function formatReviewDate(date: string | null) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const bookingRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(true);

  const [availabilityError, setAvailabilityError] = useState("");

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  /* REVIEW FORM */
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState("");

  /* APPROVED REVIEWS */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  /* PATIENT INFORMATION */
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  /* TODAY - CLIENT ONLY TO AVOID HYDRATION ERROR */
  const [todayString, setTodayString] = useState("");

  const statsInView = useInView(statsRef, {
    once: true,
    amount: 0.3,
  });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", "18%"]
  );

  const imageScale = useTransform(
    scrollYProgress,
    [0, 1],
    [1, 1.12]
  );

  const heroOpacity = useTransform(
    scrollYProgress,
    [0, 0.8],
    [1, 0]
  );

  useEffect(() => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    setTodayString(`${year}-${month}-${day}`);
  }, []);

  /*
    LOAD SERVICES
  */
  useEffect(() => {
    let mounted = true;

    const loadServices = async () => {
      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from("services")
          .select("id, name, description, price, duration")
          .order("id", { ascending: true });

        if (error) {
          console.error("Services error:", error);

          if (mounted) {
            setBookingError(
              "Could not load services. Please refresh the page."
            );
          }

          return;
        }

        if (mounted) {
          const serviceData = (data || []) as Service[];

          setServices(serviceData);

          if (serviceData.length > 0) {
            setSelectedServiceId((current) => {
              if (
                current &&
                serviceData.some((service) => service.id === current)
              ) {
                return current;
              }

              return serviceData[0].id;
            });
          }
        }
      } catch (error) {
        console.error("Failed to load services:", error);

        if (mounted) {
          setBookingError(
            "Could not load services. Please refresh the page."
          );
        }
      }
    };

    loadServices();

    return () => {
      mounted = false;
    };
  }, []);

  /*
    LOAD WORKING HOURS
  */
  useEffect(() => {
    let mounted = true;

    const loadWorkingHours = async () => {
      setWorkingHoursLoading(true);

      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from("working_hours")
          .select(
            "id, day_of_week, day_name, is_open, start_time, end_time, slot_duration"
          )
          .order("day_of_week", { ascending: true });

        if (error) {
          console.error("Working hours error:", error);

          if (mounted) {
            setWorkingHours([]);
            setAvailabilityError(
              "Could not load clinic working hours. Please refresh the page."
            );
          }

          return;
        }

        if (mounted) {
          setWorkingHours((data || []) as WorkingHour[]);
          setAvailabilityError("");
        }
      } catch (error) {
        console.error("Failed to load working hours:", error);

        if (mounted) {
          setWorkingHours([]);
          setAvailabilityError(
            "Could not load clinic working hours. Please refresh the page."
          );
        }
      } finally {
        if (mounted) {
          setWorkingHoursLoading(false);
        }
      }
    };

    loadWorkingHours();

    return () => {
      mounted = false;
    };
  }, []);

  /*
    LOAD APPROVED REVIEWS
  */
  useEffect(() => {
    let mounted = true;

    const loadReviews = async () => {
      setReviewsLoading(true);

      try {
        const supabase = createClient();

        const { data, error } = await supabase
          .from("reviews")
          .select("id, patient_name, rating, comment, created_at")
          .eq("status", "approved")
          .eq("approved", true)
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          console.error("Reviews error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });

          if (mounted) {
            setReviews([]);
          }

          return;
        }

        if (mounted) {
          setReviews((data || []) as Review[]);
        }
      } catch (error) {
        console.error("Failed to load reviews:", error);

        if (mounted) {
          setReviews([]);
        }
      } finally {
        if (mounted) {
          setReviewsLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      mounted = false;
    };
  }, []);

  /*
    LOAD BOOKED TIMES
  */
  useEffect(() => {
    let cancelled = false;

    const loadBookedTimes = async () => {
      if (!selectedDate) {
        setBookedTimes([]);
        setSelectedTime("");
        setLoadingTimes(false);
        setAvailabilityError("");
        return;
      }

      const dateObject = new Date(`${selectedDate}T12:00:00`);
      const dayOfWeek = dateObject.getDay();

      const selectedWorkingHour =
        workingHours.find(
          (day) => day.day_of_week === dayOfWeek
        ) || null;

      if (!selectedWorkingHour || !selectedWorkingHour.is_open) {
        setBookedTimes([]);
        setSelectedTime("");
        setLoadingTimes(false);
        setAvailabilityError("");
        return;
      }

      setLoadingTimes(true);
      setBookedTimes([]);
      setSelectedTime("");
      setAvailabilityError("");

      try {
        const supabase = createClient();

        const { data, error } = await supabase.rpc(
          "get_booked_times",
          {
            p_date: selectedDate,
          }
        );

        if (error) {
          console.error("Availability error:", error);

          if (!cancelled) {
            setAvailabilityError(
              "Could not load available times. Please try again."
            );
          }

          return;
        }

        if (!cancelled) {
          const rows = (data || []) as BookedTimeRow[];

          const blockedTimes = rows
            .map((row) =>
              row.appointment_time
                ? row.appointment_time.slice(0, 5)
                : null
            )
            .filter(
              (time): time is string => Boolean(time)
            );

          setBookedTimes(blockedTimes);
          setAvailabilityError("");
        }
      } catch (error) {
        console.error("Failed to load booked times:", error);

        if (!cancelled) {
          setAvailabilityError(
            "Could not load available times. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTimes(false);
        }
      }
    };

    loadBookedTimes();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, workingHours]);

  const workingHourForSelectedDate = (() => {
    if (!selectedDate) {
      return null;
    }

    const date = new Date(`${selectedDate}T12:00:00`);
    const dayOfWeek = date.getDay();

    return (
      workingHours.find(
        (day) => day.day_of_week === dayOfWeek
      ) || null
    );
  })();

  const selectedDateIsWorkingDay =
    selectedDate && workingHourForSelectedDate
      ? workingHourForSelectedDate.is_open
      : selectedDate
      ? false
      : true;

  const generatedTimesForDate =
    workingHourForSelectedDate &&
    workingHourForSelectedDate.is_open
      ? generateTimeSlots(
          workingHourForSelectedDate.start_time,
          workingHourForSelectedDate.end_time,
          workingHourForSelectedDate.slot_duration
        )
      : [];

  const availableTimesForDate = generatedTimesForDate.filter(
    (time) => !bookedTimes.includes(time)
  );

  /*
    SUBMIT REVIEW
  */
  const handleReviewSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setReviewError("");

    if (!reviewName.trim()) {
      setReviewError("Please enter your name.");
      return;
    }

    if (!reviewComment.trim()) {
      setReviewError("Please write your review.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError(
        "Please choose a rating from 1 to 5 stars."
      );
      return;
    }

    setReviewLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("reviews")
        .insert({
          patient_name: reviewName.trim(),
          rating: reviewRating,
          comment: reviewComment.trim(),
          status: "pending",
          approved: false,
        });

      if (error) {
        console.error("Review insert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        throw new Error(
          error.message ||
            "Could not submit your review. Please try again."
        );
      }

      setReviewSubmitted(true);
      setReviewName("");
      setReviewRating(5);
      setReviewComment("");
    } catch (error) {
      console.error("Review submit error:", error);

      setReviewError(
        error instanceof Error
          ? error.message
          : "Could not submit your review. Please try again."
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  /*
    BOOK APPOINTMENT
  */
  const handleBooking = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setBookingError("");

    if (loadingTimes) {
      setBookingError(
        "Please wait while we check available times."
      );
      return;
    }

    setBookingLoading(true);

    try {
      if (!patientName.trim()) {
        throw new Error("Please enter your full name.");
      }

      if (!patientPhone.trim()) {
        throw new Error("Please enter your phone number.");
      }

      if (!selectedServiceId) {
        throw new Error("Please select a service.");
      }

      if (!selectedDate) {
        throw new Error("Please select an appointment date.");
      }

      if (!selectedTime) {
        throw new Error("Please select an available time.");
      }

      if (todayString && selectedDate < todayString) {
        throw new Error(
          "Please select today or a future date."
        );
      }

      const selectedDateObject = new Date(
        `${selectedDate}T12:00:00`
      );

      const dayOfWeek = selectedDateObject.getDay();

      const selectedWorkingHour =
        workingHours.find(
          (day) => day.day_of_week === dayOfWeek
        ) || null;

      if (
        !selectedWorkingHour ||
        !selectedWorkingHour.is_open
      ) {
        throw new Error(
          "The clinic is closed on this day. Please choose another date."
        );
      }

      const validTimes = generateTimeSlots(
        selectedWorkingHour.start_time,
        selectedWorkingHour.end_time,
        selectedWorkingHour.slot_duration
      );

      if (!validTimes.includes(selectedTime)) {
        throw new Error(
          "The selected time is not available."
        );
      }

      if (bookedTimes.includes(selectedTime)) {
        throw new Error(
          "Sorry, this time has just been booked. Please choose another time."
        );
      }

      if (!availableTimesForDate.includes(selectedTime)) {
        throw new Error(
          "The selected time is no longer available. Please choose another time."
        );
      }

      const supabase = createClient();

      const service = services.find(
        (item) => item.id === selectedServiceId
      );

      if (!service) {
        throw new Error(
          "The selected service could not be found."
        );
      }

      /*
        CHECK AVAILABILITY ONE MORE TIME
      */
      const {
        data: latestBookedTimes,
        error: latestAvailabilityError,
      } = await supabase.rpc(
        "get_booked_times",
        {
          p_date: selectedDate,
        }
      );

      if (latestAvailabilityError) {
        console.error(
          "Latest availability error:",
          latestAvailabilityError
        );

        throw new Error(
          "Could not verify appointment availability. Please try again."
        );
      }

      const latestRows =
        (latestBookedTimes || []) as BookedTimeRow[];

      const latestBlockedTimes = latestRows
        .map((row) =>
          row.appointment_time
            ? row.appointment_time.slice(0, 5)
            : null
        )
        .filter(
          (time): time is string => Boolean(time)
        );

      if (latestBlockedTimes.includes(selectedTime)) {
        throw new Error(
          "Sorry, this time has just been booked. Please choose another time."
        );
      }

      /*
        INSERT APPOINTMENT
      */
      const { error } = await supabase
        .from("appointments")
        .insert({
          patient_name: patientName.trim(),
          phone: patientPhone.trim(),
          email: patientEmail.trim() || null,
          service_id: service.id,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          status: "pending",
        });

      if (error) {
        if (error.code === "23505") {
          setBookedTimes((current) =>
            current.includes(selectedTime)
              ? current
              : [...current, selectedTime]
          );

          throw new Error(
            "Sorry, this time has just been booked. Please choose another time."
          );
        }

        console.error(
          "Appointment insert error:",
          error
        );

        throw new Error(
          error.message ||
            "Could not create appointment. Please try again."
        );
      }

      setSubmitted(true);
      setBookingError("");
    } catch (error) {
      console.error("Booking error:", error);

      setBookingError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f7f3] text-[#123d3b]">

      {/* NAVIGATION */}
      <header className="fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto mt-3 flex max-w-[1450px] items-center justify-between rounded-full border border-white/30 bg-[#f7f7f3]/75 px-5 py-3 shadow-lg shadow-black/5 backdrop-blur-xl md:px-7">
          <a
            href="#home"
            className="text-sm font-semibold tracking-[-0.04em] md:text-base"
          >
            DR<span className="text-[#71a9a4]">.</span>{" "}
            BRITNEY
          </a>

          <nav className="hidden items-center gap-7 text-[10px] font-semibold tracking-[0.16em] text-[#123d3b]/60 lg:flex">
            <a
              href="#services"
              className="transition hover:text-[#123d3b]"
            >
              SERVICES
            </a>

            <a
              href="#doctor"
              className="transition hover:text-[#123d3b]"
            >
              DOCTOR
            </a>

            <a
              href="#reviews"
              className="transition hover:text-[#123d3b]"
            >
              REVIEWS
            </a>

            <a
              href="#faq"
              className="transition hover:text-[#123d3b]"
            >
              FAQ
            </a>
          </nav>

          <button
            onClick={scrollToBooking}
            className="rounded-full bg-[#123d3b] px-5 py-3 text-[10px] font-semibold tracking-[0.16em] text-white transition hover:bg-[#1b514d]"
          >
            BOOK APPOINTMENT
          </button>
        </div>
      </header>

      {/* HERO */}
      <section
        ref={heroRef}
        id="home"
        className="relative flex min-h-screen items-end overflow-hidden bg-[#123d3b]"
      >
        <motion.div
          style={{
            y: imageY,
            scale: imageScale,
          }}
          className="absolute inset-0"
        >
          <img
            src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=2200&q=90"
            alt="Modern dental clinic"
            className="h-full w-full object-cover object-center opacity-75"
          />

          <div className="absolute inset-0 bg-[#0d302e]/35" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#071d1c] via-[#123d3b]/10 to-transparent" />
        </motion.div>

        <div className="absolute -right-32 top-24 h-96 w-96 rounded-full bg-[#9ad8d0]/20 blur-[120px]" />

        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 mx-auto w-full max-w-[1450px] px-5 pb-12 pt-40 md:px-10 md:pb-16"
        >
          <div className="mb-7 flex items-center gap-3 text-[10px] font-semibold tracking-[0.25em] text-white/60">
            <span className="h-px w-10 bg-[#a7ded8]" />
            ADVANCED DENTAL CARE
          </div>

          <h1 className="max-w-[1200px] text-[17vw] font-medium leading-[0.79] tracking-[-0.085em] text-white md:text-[10vw]">
            <motion.span
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
              className="block"
            >
              YOUR
            </motion.span>

            <motion.span
              initial={{ opacity: 0, y: 90 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.12,
              }}
              className="block text-[#a8ddd7]"
            >
              SMILE.
            </motion.span>

            <motion.span
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.24,
              }}
              className="block"
            >
              PERFECTED
              <span className="text-[#a8ddd7]">.</span>
            </motion.span>
          </h1>

          <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="max-w-md text-sm leading-6 text-white/60 md:text-base">
              Modern dentistry with a personal approach. Designed around your
              health, your comfort and the smile you want to show the world.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={scrollToBooking}
                className="rounded-full bg-[#a8ddd7] px-7 py-4 text-[10px] font-bold tracking-[0.18em] text-[#123d3b] transition hover:bg-white"
              >
                BOOK YOUR VISIT
              </button>

              <a
                href="#services"
                className="rounded-full border border-white/30 px-7 py-4 text-[10px] font-bold tracking-[0.18em] text-white transition hover:bg-white hover:text-[#123d3b]"
              >
                EXPLORE SERVICES
              </a>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-8 right-8 hidden text-[9px] tracking-[0.25em] text-white/40 md:block">
          SCROLL TO DISCOVER ↓
        </div>
      </section>

      {/* INTRO */}
      <section className="bg-[#f7f7f3] py-24 md:py-36">
        <div className="mx-auto max-w-[1450px] px-5 md:px-10">
          <div className="grid gap-14 md:grid-cols-2 md:items-end">
            <Reveal>
              <p className="mb-6 text-[10px] font-bold tracking-[0.25em] text-[#123d3b]/40">
                DENTISTRY, REIMAGINED
              </p>

              <h2 className="max-w-3xl text-[12vw] font-medium leading-[0.82] tracking-[-0.075em] md:text-[8vw]">
                HEALTHY
                <br />
                LOOKS
                <br />
                <span className="text-[#75aaa5]">
                  GOOD.
                </span>
              </h2>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="max-w-lg md:pb-3">
                <p className="text-xl leading-7 text-[#123d3b]/70 md:text-2xl">
                  Dentistry should feel calm, precise and human.
                </p>

                <p className="mt-7 text-sm leading-6 text-[#123d3b]/45">
                  From routine care to complete smile transformations, every
                  treatment is planned with attention to detail and your
                  individual needs.
                </p>

                <div className="mt-8 flex items-center gap-3 text-[10px] font-bold tracking-[0.2em]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#123d3b] text-white">
                    +
                  </span>
                  PATIENT-FIRST CARE
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        className="bg-[#e8efeb] py-24 md:py-36"
      >
        <div className="mx-auto max-w-[1450px] px-5 md:px-10">
          <Reveal>
            <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div>
                <p className="mb-5 text-[10px] font-bold tracking-[0.25em] text-[#123d3b]/40">
                  WHAT WE OFFER
                </p>

                <h2 className="text-[13vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                  OUR
                  <br />
                  SERVICES
                  <span className="text-[#75aaa5]">.</span>
                </h2>
              </div>

              <p className="max-w-sm text-sm leading-6 text-[#123d3b]/50">
                Modern treatments, advanced technology and a calm environment
                designed around you.
              </p>
            </div>
          </Reveal>

          <div className="border-t border-[#123d3b]/15">
            {services.length === 0 ? (
              <div className="py-12 text-sm text-[#123d3b]/50">
                Loading services...
              </div>
            ) : (
              services.map((service, index) => (
                <Reveal
                  key={service.id}
                  delay={index * 0.06}
                >
                  <motion.div
                    whileHover={{ x: 8 }}
                    className="group grid gap-6 border-b border-[#123d3b]/15 py-9 md:grid-cols-[90px_90px_1fr_40px] md:items-center md:py-12"
                  >
                    <span className="text-[10px] font-bold tracking-[0.2em] text-[#75aaa5]">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#123d3b]/15 text-xl transition group-hover:border-[#123d3b] group-hover:bg-[#123d3b] group-hover:text-white">
                      {index === 0
                        ? "✦"
                        : index === 1
                        ? "◌"
                        : index === 2
                        ? "＋"
                        : index === 3
                        ? "⌁"
                        : "✧"}
                    </span>

                    <div>
                      <h3 className="text-2xl font-medium tracking-[-0.04em] md:text-4xl">
                        {service.name}
                      </h3>

                      <p className="mt-3 max-w-xl text-sm leading-6 text-[#123d3b]/45">
                        {service.description ||
                          "Professional dental care designed around your individual needs."}
                      </p>

                      {service.duration ? (
                        <p className="mt-2 text-[9px] font-semibold tracking-[0.15em] text-[#123d3b]/35">
                          {service.duration} MINUTES
                        </p>
                      ) : null}
                    </div>

                    <span className="text-2xl text-[#123d3b]/30 transition group-hover:text-[#123d3b]">
                      ↗
                    </span>
                  </motion.div>
                </Reveal>
              ))
            )}
          </div>
        </div>
      </section>

      {/* DOCTOR */}
      <section
        id="doctor"
        className="bg-[#123d3b] text-white"
      >
        <div className="mx-auto grid max-w-[1450px] gap-14 px-5 py-24 md:grid-cols-2 md:px-10 md:py-36">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem]">
              <img
                src="https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=1200&q=90"
                alt="Dr. Britney"
                className="aspect-[4/5] w-full object-cover"
              />

              <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-5 py-3 text-[9px] font-bold tracking-[0.18em] text-[#123d3b] backdrop-blur">
                DR. BRITNEY
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex h-full flex-col justify-center">
              <p className="mb-6 text-[10px] font-bold tracking-[0.25em] text-white/40">
                MEET YOUR DENTIST
              </p>

              <h2 className="text-[14vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                CARE
                <br />
                WITH
                <br />
                <span className="text-[#a8ddd7]">
                  PURPOSE.
                </span>
              </h2>

              <p className="mt-10 max-w-xl text-base leading-7 text-white/55">
                Dr. Britney combines modern cosmetic dentistry with a
                conservative, patient-first philosophy. Every treatment begins
                with listening, understanding and creating a plan that feels
                right for you.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-8 border-t border-white/15 pt-8">
                <div>
                  <div className="text-3xl font-medium">
                    12+
                  </div>

                  <div className="mt-2 text-[9px] tracking-[0.18em] text-white/35">
                    YEARS EXPERIENCE
                  </div>
                </div>

                <div>
                  <div className="text-3xl font-medium">
                    4.9/5
                  </div>

                  <div className="mt-2 text-[9px] tracking-[0.18em] text-white/35">
                    PATIENT RATING
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="bg-[#f7f7f3] py-24 md:py-36">
        <div className="mx-auto max-w-[1450px] px-5 md:px-10">
          <Reveal>
            <div className="mb-16">
              <p className="mb-5 text-[10px] font-bold tracking-[0.25em] text-[#123d3b]/40">
                TRANSFORMATIONS
              </p>

              <h2 className="text-[13vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                SUBTLE.
                <br />
                NATURAL.
                <br />
                <span className="text-[#75aaa5]">
                  YOU.
                </span>
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-[1.5rem]">
                <img
                  src="https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1200&q=90"
                  alt="Dental smile result"
                  className="aspect-[4/3] w-full object-cover"
                />

                <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-3 text-[9px] font-bold tracking-[0.18em] backdrop-blur">
                  BEFORE
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.5rem]">
                <img
                  src="https://images.unsplash.com/photo-1606265752439-1f18756aa2b1?auto=format&fit=crop&w=1200&q=90"
                  alt="Beautiful smile"
                  className="aspect-[4/3] w-full object-cover"
                />

                <div className="absolute bottom-5 left-5 rounded-full bg-[#123d3b] px-4 py-3 text-[9px] font-bold tracking-[0.18em] text-white">
                  AFTER
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-[#a8d8d2] py-20 md:py-28">
        <div
          ref={statsRef}
          className="mx-auto grid max-w-[1450px] gap-10 px-5 md:grid-cols-4 md:px-10"
        >
          <Counter
            number="2.5K+"
            label="SMILES CREATED"
          />

          <Counter
            number="12+"
            label="YEARS EXPERIENCE"
          />

          <Counter
            number="98%"
            label="PATIENT SATISFACTION"
          />

          <Counter
            number="4.9"
            label="AVERAGE RATING"
          />
        </div>
      </section>

      {/* BOOKING */}
      <section
        ref={bookingRef}
        id="booking"
        className="bg-[#123d3b] py-24 text-white md:py-36"
      >
        <div className="mx-auto max-w-[1450px] px-5 md:px-10">
          <div className="grid gap-16 lg:grid-cols-[.85fr_1.15fr]">

            <Reveal>
              <div>
                <p className="mb-6 text-[10px] font-bold tracking-[0.25em] text-white/40">
                  TAKE THE FIRST STEP
                </p>

                <h2 className="text-[14vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                  BOOK
                  <br />
                  YOUR
                  <br />
                  <span className="text-[#a8ddd7]">
                    VISIT.
                  </span>
                </h2>

                <p className="mt-10 max-w-md text-sm leading-6 text-white/45">
                  Tell us what you&apos;re looking for and choose a convenient
                  time. Our team will confirm your appointment.
                </p>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-white/35">
                    CLINIC HOURS
                  </p>

                  {workingHoursLoading ? (
                    <p className="mt-4 text-sm text-white/45">
                      Loading clinic hours...
                    </p>
                  ) : workingHours.length === 0 ? (
                    <p className="mt-4 text-sm text-red-300">
                      Working hours are not available.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {workingHours.map((day) => (
                        <div
                          key={day.id}
                          className="flex items-center justify-between gap-4 text-xs"
                        >
                          <span className="text-white/65">
                            {day.day_name}
                          </span>

                          {day.is_open ? (
                            <span className="text-[#a8ddd7]">
                              {formatTime(day.start_time)}{" "}
                              –{" "}
                              {formatTime(day.end_time)}
                            </span>
                          ) : (
                            <span className="text-white/30">
                              Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <form
                onSubmit={handleBooking}
                className="rounded-[2rem] bg-white p-6 text-[#123d3b] md:p-10"
              >
                {!submitted ? (
                  <>
                    <div className="mb-8">
                      <p className="text-[9px] font-bold tracking-[0.2em] text-[#123d3b]/40">
                        APPOINTMENT REQUEST
                      </p>

                      <h3 className="mt-2 text-3xl font-medium tracking-[-0.05em]">
                        Let&apos;s find a time.
                      </h3>
                    </div>

                    <div className="grid gap-5">

                      {/* FULL NAME - FIXED */}
                      <div>
                        <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                          FULL NAME
                        </label>

                        <input
                          required
                          type="text"
                          maxLength={100}
                          placeholder="Your full name"
                          value={patientName}
                          onChange={(e) => {
                            setPatientName(e.target.value);
                            setBookingError("");
                          }}
                          className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none transition focus:border-[#75aaa5]"
                        />
                      </div>

                      {/* PHONE + EMAIL */}
                      <div className="grid gap-5 md:grid-cols-2">

                        <div>
                          <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                            PHONE
                          </label>

                          <input
                            required
                            type="tel"
                            maxLength={30}
                            placeholder="+20 1XX XXX XXXX"
                            value={patientPhone}
                            onChange={(e) => {
                              setPatientPhone(e.target.value);
                              setBookingError("");
                            }}
                            className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none transition focus:border-[#75aaa5]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                            EMAIL
                          </label>

                          <input
                            type="email"
                            maxLength={150}
                            placeholder="you@email.com"
                            value={patientEmail}
                            onChange={(e) => {
                              setPatientEmail(e.target.value);
                              setBookingError("");
                            }}
                            className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none transition focus:border-[#75aaa5]"
                          />
                        </div>

                      </div>

                      {/* SERVICE */}
                      <div>
                        <label className="mb-3 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                          SELECT SERVICE
                        </label>

                        {services.length === 0 ? (
                          <div className="rounded-xl bg-[#f7f7f3] px-4 py-4 text-sm text-[#123d3b]/40">
                            Loading services...
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {services.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => {
                                  setSelectedServiceId(service.id);
                                  setBookingError("");
                                }}
                                className={`rounded-xl border px-3 py-3 text-left text-xs transition ${
                                  selectedServiceId === service.id
                                    ? "border-[#123d3b] bg-[#123d3b] text-white"
                                    : "border-[#123d3b]/10 bg-[#f7f7f3] hover:border-[#123d3b]/30"
                                }`}
                              >
                                {service.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* DATE + TIME */}
                      <div className="grid gap-5 md:grid-cols-2">

                        {/* DATE */}
                        <div>
                          <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                            PREFERRED DATE
                          </label>

                          <input
                            required
                            type="date"
                            min={todayString}
                            value={selectedDate}
                            onChange={(e) => {
                              setSelectedDate(e.target.value);
                              setSelectedTime("");
                              setBookingError("");
                              setAvailabilityError("");
                            }}
                            className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none focus:border-[#75aaa5]"
                          />

                          {selectedDate &&
                            !selectedDateIsWorkingDay && (
                              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                                The clinic is closed on this day. Please
                                choose another date.
                              </p>
                            )}
                        </div>

                        {/* TIME */}
                        <div>
                          <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                            AVAILABLE TIME
                          </label>

                          <select
                            required
                            value={selectedTime}
                            disabled={
                              !selectedDate ||
                              !selectedDateIsWorkingDay ||
                              loadingTimes ||
                              Boolean(availabilityError) ||
                              availableTimesForDate.length === 0
                            }
                            onChange={(e) => {
                              setSelectedTime(e.target.value);
                              setBookingError("");
                            }}
                            className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none focus:border-[#75aaa5] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">
                              {workingHoursLoading
                                ? "Loading clinic hours..."
                                : loadingTimes
                                ? "Checking availability..."
                                : availabilityError
                                ? "Availability unavailable"
                                : !selectedDate
                                ? "Choose date first"
                                : !selectedDateIsWorkingDay
                                ? "Clinic closed"
                                : availableTimesForDate.length === 0
                                ? "No times available"
                                : "Choose time"}
                            </option>

                            {availableTimesForDate.map((time) => (
                              <option key={time} value={time}>
                                {formatTime(time)}
                              </option>
                            ))}
                          </select>

                          {selectedDate &&
                            selectedDateIsWorkingDay &&
                            !loadingTimes &&
                            !availabilityError &&
                            availableTimesForDate.length === 0 && (
                              <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                                All appointments are booked for this day.
                                Please choose another date.
                              </p>
                            )}
                        </div>

                      </div>

                      {/* AVAILABLE TIMES MESSAGE */}
                      {selectedDate &&
                        selectedDateIsWorkingDay &&
                        !loadingTimes &&
                        !availabilityError &&
                        availableTimesForDate.length > 0 && (
                          <div className="rounded-xl bg-[#e8efeb] px-4 py-3 text-xs text-[#123d3b]/60">
                            {availableTimesForDate.length} appointment{" "}
                            {availableTimesForDate.length === 1
                              ? "time"
                              : "times"}{" "}
                            available for this day.
                          </div>
                        )}

                      {/* AVAILABILITY ERROR */}
                      {availabilityError && (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                          {availabilityError}
                        </p>
                      )}

                      {/* BOOKING ERROR */}
                      {bookingError && (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                          {bookingError}
                        </p>
                      )}

                      {/* SUBMIT */}
                      <button
                        type="submit"
                        disabled={
                          bookingLoading ||
                          services.length === 0 ||
                          workingHoursLoading ||
                          Boolean(availabilityError) ||
                          !selectedServiceId ||
                          !selectedDate ||
                          !selectedTime ||
                          !selectedDateIsWorkingDay ||
                          loadingTimes
                        }
                        className="mt-3 rounded-full bg-[#123d3b] px-7 py-5 text-[10px] font-bold tracking-[0.2em] text-white transition hover:bg-[#1b514d] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bookingLoading
                          ? "SENDING REQUEST..."
                          : "REQUEST APPOINTMENT →"}
                      </button>

                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.95,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    className="flex min-h-[500px] flex-col items-center justify-center text-center"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#a8d8d2] text-3xl">
                      ✓
                    </div>

                    <h3 className="mt-7 text-4xl font-medium tracking-[-0.05em]">
                      REQUEST RECEIVED.
                    </h3>

                    <p className="mt-5 max-w-md text-sm leading-6 text-[#123d3b]/50">
                      Thank you. Your appointment request has been received.
                      Our team will contact you shortly to confirm your
                      appointment.
                    </p>

                    <div className="mt-6 rounded-xl bg-[#f7f7f3] px-5 py-4 text-left text-xs text-[#123d3b]/60">
                      <p>
                        <strong>Service:</strong>{" "}
                        {
                          services.find(
                            (service) =>
                              service.id === selectedServiceId
                          )?.name
                        }
                      </p>

                      <p className="mt-1">
                        <strong>Date:</strong>{" "}
                        {selectedDate}
                      </p>

                      <p className="mt-1">
                        <strong>Time:</strong>{" "}
                        {selectedTime
                          ? formatTime(selectedTime)
                          : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setSelectedDate("");
                        setSelectedTime("");
                        setPatientName("");
                        setPatientPhone("");
                        setPatientEmail("");
                        setBookingError("");
                        setAvailabilityError("");
                        setBookedTimes([]);
                      }}
                      className="mt-8 rounded-full border border-[#123d3b]/15 px-6 py-3 text-[10px] font-bold tracking-[0.15em] transition hover:bg-[#123d3b] hover:text-white"
                    >
                      BOOK ANOTHER VISIT
                    </button>
                  </motion.div>
                )}
              </form>
            </Reveal>

          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section
        id="reviews"
        className="bg-[#f7f7f3] py-24 md:py-36"
      >
        <div className="mx-auto max-w-[1450px] px-5 md:px-10">

          <Reveal>
            <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div>
                <p className="mb-5 text-[10px] font-bold tracking-[0.25em] text-[#123d3b]/40">
                  PATIENT STORIES
                </p>

                <h2 className="text-[13vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                  YOUR
                  <br />
                  <span className="text-[#75aaa5]">
                    VOICE.
                  </span>
                </h2>
              </div>

              <div className="text-right">
                <div className="text-4xl">
                  ★★★★★
                </div>

                <p className="mt-2 text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/40">
                  YOUR EXPERIENCE MATTERS
                </p>
              </div>
            </div>
          </Reveal>

          {/* APPROVED REVIEWS */}
          <Reveal delay={0.05}>
            {reviewsLoading ? (
              <div className="mb-10 rounded-[2rem] bg-[#e8efeb] px-6 py-10 text-center text-sm text-[#123d3b]/45">
                Loading patient reviews...
              </div>
            ) : reviews.length > 0 ? (
              <div className="mb-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((review, index) => (
                  <motion.div
                    key={review.id}
                    initial={{
                      opacity: 0,
                      y: 25,
                    }}
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                      amount: 0.15,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: index * 0.05,
                    }}
                    className="flex min-h-[260px] flex-col rounded-[1.5rem] bg-[#e8efeb] p-6 md:p-7"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold tracking-[-0.02em]">
                          {review.patient_name}
                        </div>

                        {review.created_at ? (
                          <div className="mt-1 text-[9px] font-semibold tracking-[0.12em] text-[#123d3b]/35">
                            {formatReviewDate(review.created_at)}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 gap-0.5 text-sm text-[#123d3b]">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              star <= review.rating
                                ? "opacity-100"
                                : "opacity-15"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-7 h-px w-full bg-[#123d3b]/10" />

                    <p className="mt-6 flex-1 text-sm leading-6 text-[#123d3b]/65">
                      &ldquo;{review.comment}&rdquo;
                    </p>

                    <div className="mt-6 flex items-center gap-2 text-[9px] font-bold tracking-[0.16em] text-[#123d3b]/30">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#123d3b] text-white">
                        ✓
                      </span>

                      VERIFIED EXPERIENCE
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="mb-10 rounded-[2rem] border border-[#123d3b]/10 bg-[#e8efeb] px-6 py-12 text-center">
                <div className="text-3xl">
                  ★★★★★
                </div>

                <p className="mt-4 text-sm text-[#123d3b]/45">
                  No approved reviews yet.
                </p>

                <p className="mt-2 text-xs text-[#123d3b]/30">
                  Be the first patient to share your experience.
                </p>
              </div>
            )}
          </Reveal>

          {/* WRITE A REVIEW */}
          <Reveal delay={0.1}>
            <div className="grid gap-10 rounded-[2rem] bg-[#e8efeb] p-6 md:grid-cols-[0.75fr_1.25fr] md:p-10">

              <div className="flex flex-col justify-center">
                <p className="text-[9px] font-bold tracking-[0.2em] text-[#123d3b]/40">
                  SHARE YOUR EXPERIENCE
                </p>

                <h3 className="mt-3 text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                  Write a review.
                </h3>

                <p className="mt-5 max-w-md text-sm leading-6 text-[#123d3b]/50">
                  Tell us about your experience with Dr. Britney. Your review
                  will be checked by our team before it appears publicly.
                </p>

                <div className="mt-8 rounded-2xl border border-[#123d3b]/10 bg-white/60 p-5">
                  <p className="text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/40">
                    HOW IT WORKS
                  </p>

                  <div className="mt-4 space-y-3 text-xs leading-5 text-[#123d3b]/55">

                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#123d3b] text-[10px] text-white">
                        1
                      </span>

                      <span>
                        Write your review and choose your rating.
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#123d3b] text-[10px] text-white">
                        2
                      </span>

                      <span>
                        Our team reviews your submission.
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#123d3b] text-[10px] text-white">
                        3
                      </span>

                      <span>
                        Approved reviews appear on the website.
                      </span>
                    </div>

                  </div>
                </div>
              </div>

              {!reviewSubmitted ? (
                <form
                  onSubmit={handleReviewSubmit}
                  className="rounded-[1.5rem] bg-white p-6 md:p-8"
                >
                  <div className="grid gap-5">

                    <div>
                      <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                        YOUR NAME
                      </label>

                      <input
                        required
                        type="text"
                        maxLength={80}
                        placeholder="Your name"
                        value={reviewName}
                        onChange={(e) => {
                          setReviewName(e.target.value);
                          setReviewError("");
                        }}
                        className="w-full rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm outline-none transition focus:border-[#75aaa5]"
                      />
                    </div>

                    <div>
                      <label className="mb-3 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                        YOUR RATING
                      </label>

                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={`${star} star${
                              star > 1 ? "s" : ""
                            }`}
                            onClick={() => {
                              setReviewRating(star);
                              setReviewError("");
                            }}
                            className={`text-3xl leading-none transition ${
                              star <= reviewRating
                                ? "text-[#123d3b]"
                                : "text-[#123d3b]/15"
                            } hover:scale-110`}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      <p className="mt-2 text-[10px] text-[#123d3b]/35">
                        {reviewRating} out of 5 stars
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-bold tracking-[0.18em] text-[#123d3b]/45">
                        YOUR REVIEW
                      </label>

                      <textarea
                        required
                        rows={5}
                        maxLength={1000}
                        placeholder="Tell us about your experience..."
                        value={reviewComment}
                        onChange={(e) => {
                          setReviewComment(e.target.value);
                          setReviewError("");
                        }}
                        className="w-full resize-none rounded-xl border border-[#123d3b]/10 bg-[#f7f7f3] px-4 py-4 text-sm leading-6 outline-none transition focus:border-[#75aaa5]"
                      />
                    </div>

                    {reviewError && (
                      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                        {reviewError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={reviewLoading}
                      className="rounded-full bg-[#123d3b] px-7 py-5 text-[10px] font-bold tracking-[0.2em] text-white transition hover:bg-[#1b514d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reviewLoading
                        ? "SUBMITTING..."
                        : "SUBMIT REVIEW →"}
                    </button>

                  </div>
                </form>
              ) : (
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.97,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  className="flex min-h-[400px] flex-col items-center justify-center rounded-[1.5rem] bg-white p-8 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#a8d8d2] text-2xl">
                    ✓
                  </div>

                  <h3 className="mt-6 text-3xl font-medium tracking-[-0.05em]">
                    THANK YOU!
                  </h3>

                  <p className="mt-4 max-w-md text-sm leading-6 text-[#123d3b]/50">
                    Your review has been submitted successfully and is waiting
                    for approval.
                  </p>

                  <p className="mt-3 text-xs text-[#123d3b]/35">
                    Once approved, it will appear publicly on the website.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewSubmitted(false);
                      setReviewError("");
                    }}
                    className="mt-7 rounded-full border border-[#123d3b]/15 px-6 py-3 text-[10px] font-bold tracking-[0.15em] transition hover:bg-[#123d3b] hover:text-white"
                  >
                    WRITE ANOTHER REVIEW
                  </button>
                </motion.div>
              )}

            </div>
          </Reveal>

        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="bg-[#e8efeb] py-24 md:py-36"
      >
        <div className="mx-auto max-w-[1200px] px-5 md:px-10">
          <Reveal>
            <div className="mb-14 text-center">
              <p className="mb-5 text-[10px] font-bold tracking-[0.25em] text-[#123d3b]/40">
                NEED TO KNOW
              </p>

              <h2 className="text-[14vw] font-medium leading-[0.8] tracking-[-0.08em] md:text-[8vw]">
                QUESTIONS
                <span className="text-[#75aaa5]">
                  ?
                </span>
              </h2>
            </div>
          </Reveal>

          <div className="border-t border-[#123d3b]/15">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <Reveal
                  key={faq.question}
                  delay={index * 0.05}
                >
                  <div className="border-b border-[#123d3b]/15">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFaq(
                          isOpen ? null : index
                        )
                      }
                      className="flex w-full items-center justify-between gap-5 py-7 text-left"
                    >
                      <span className="text-sm font-semibold tracking-[-0.01em] md:text-lg">
                        {faq.question}
                      </span>

                      <motion.span
                        animate={{
                          rotate: isOpen ? 45 : 0,
                        }}
                        className="text-2xl font-light"
                      >
                        +
                      </motion.span>
                    </button>

                    <motion.div
                      initial={false}
                      animate={{
                        height: isOpen ? "auto" : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-7 text-sm leading-6 text-[#123d3b]/50">
                        {faq.answer}
                      </p>
                    </motion.div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#123d3b] py-28 text-white md:py-40">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#a8d8d2]/15 blur-[130px]" />

        <div className="relative mx-auto max-w-[1450px] px-5 md:px-10">
          <Reveal>
            <p className="mb-7 text-[10px] font-bold tracking-[0.25em] text-white/35">
              YOUR NEXT SMILE STARTS HERE
            </p>

            <h2 className="max-w-6xl text-[15vw] font-medium leading-[0.78] tracking-[-0.085em] md:text-[9vw]">
              READY TO
              <br />
              LOVE YOUR
              <br />
              <span className="text-[#a8ddd7]">
                SMILE?
              </span>
            </h2>

            <div className="mt-12 flex flex-wrap gap-3">
              <button
                onClick={scrollToBooking}
                className="rounded-full bg-[#a8ddd7] px-8 py-5 text-[10px] font-bold tracking-[0.2em] text-[#123d3b] transition hover:bg-white"
              >
                BOOK AN APPOINTMENT
              </button>

              <a
                href="tel:+201206965591"
                className="rounded-full border border-white/20 px-8 py-5 text-[10px] font-bold tracking-[0.2em] transition hover:bg-white hover:text-[#123d3b]"
              >
                CALL THE CLINIC
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0b2928] text-white">
        <div className="mx-auto max-w-[1450px] px-5 py-12 md:px-10">
          <div className="grid gap-10 md:grid-cols-3">

            <div>
              <div className="text-xl font-semibold tracking-[-0.05em]">
                DR<span className="text-[#a8ddd7]">.</span>{" "}
                BRITNEY
              </div>

              <p className="mt-3 max-w-xs text-xs leading-5 text-white/35">
                Modern dentistry. Personal care. Beautiful, healthy smiles.
              </p>
            </div>

            <div>
              <p className="mb-4 text-[9px] font-bold tracking-[0.2em] text-white/30">
                CONTACT
              </p>

              <a
                href="tel:+201206965591"
                className="block text-sm text-white/65 hover:text-white"
              >
                +20 12 0696 5591
              </a>

              <a
                href="mailto:DrBritney@gmail.com"
                className="mt-2 block text-sm text-white/65 hover:text-white"
              >
                DrBritney@gmail.com
              </a>
            </div>

            <div>
              <p className="mb-4 text-[9px] font-bold tracking-[0.2em] text-white/30">
                CLINIC
              </p>

              <p className="text-sm leading-6 text-white/55">
                Beba
                <br />
                BaniSuef, Egypt
              </p>
            </div>

          </div>

          <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-7 text-[9px] tracking-[0.15em] text-white/25 md:flex-row">
            <span>
              © 2026 DR. BRITNEY DENTAL CLINIC
            </span>

            <span>
              DESIGNED FOR BETTER SMILES.
            </span>
          </div>
        </div>
      </footer>

    </main>
  );
}