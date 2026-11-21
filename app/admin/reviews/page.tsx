"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/app/admin/components/adminsidebar";

type ReviewStatus = "pending" | "approved" | "rejected";

type Review = {
  id: number;
  patient_name: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  approved: boolean | null;
  created_at: string | null;
};

export default function AdminReviewsPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadReviews = async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // Check login
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      // Check admin
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        console.error("Admin verification error:", {
          message: adminError.message,
          details: adminError.details,
          hint: adminError.hint,
          code: adminError.code,
        });

        setError("Unable to verify admin access.");
        return;
      }

      if (!admin) {
        router.replace("/admin/login");
        return;
      }

      // Load reviews
      const { data, error: reviewsError } = await supabase
        .from("reviews")
        .select(
          "id, patient_name, rating, comment, status, approved, created_at"
        )
        .order("created_at", { ascending: false });

      if (reviewsError) {
        console.error("Reviews loading error:", {
          message: reviewsError.message,
          details: reviewsError.details,
          hint: reviewsError.hint,
          code: reviewsError.code,
        });

        setError(
          reviewsError.message || "Unable to load reviews."
        );

        return;
      }

      setReviews((data || []) as Review[]);
    } catch (err) {
      console.error("Load reviews error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading reviews."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const updateReviewStatus = async (
    id: number,
    status: "approved" | "rejected"
  ) => {
    setActionLoading(id);
    setError("");

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("reviews")
        .update({
          status,
          approved: status === "approved",
        })
        .eq("id", id);

      if (error) {
        console.error("Update review error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        setError(
          error.message || "Failed to update review."
        );

        return;
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === id
            ? {
                ...review,
                status,
                approved: status === "approved",
              }
            : review
        )
      );
    } catch (err) {
      console.error("Update review error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update review."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const deleteReview = async (id: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?"
    );

    if (!confirmed) return;

    setActionLoading(id);
    setError("");

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete review error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        setError(
          error.message || "Failed to delete review."
        );

        return;
      }

      setReviews((current) =>
        current.filter((review) => review.id !== id)
      );
    } catch (err) {
      console.error("Delete review error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete review."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const pendingReviews = reviews.filter(
    (review) => review.status === "pending"
  );

  const approvedReviews = reviews.filter(
    (review) => review.status === "approved"
  );

  const rejectedReviews = reviews.filter(
    (review) => review.status === "rejected"
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1 text-lg">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={
              star <= rating
                ? "text-yellow-500"
                : "text-gray-300"
            }
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Unknown date";

    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] text-gray-900">
        <AdminSidebar />

        <main className="ml-64 p-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              Loading reviews...
            </p>
          </div>
        </main>
      </div>
    );
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
              DR. BRITNEY
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              Reviews Management
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage patient reviews before they appear on the website.
            </p>
          </div>

          <button
            onClick={loadReviews}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Statistics */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              All Reviews
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {reviews.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-500">
              {pendingReviews.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Approved
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {approvedReviews.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Rejected
            </p>

            <p className="mt-2 text-3xl font-bold text-red-500">
              {rejectedReviews.length}
            </p>
          </div>

        </div>

        {/* Reviews */}
        <div className="space-y-5">

          {reviews.length === 0 ? (

            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
                ★
              </div>

              <p className="mt-4 text-lg font-semibold text-gray-800">
                No reviews yet
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Patient reviews will appear here after they are submitted.
              </p>
            </div>

          ) : (

            reviews.map((review) => (

              <div
                key={review.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >

                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                  {/* Review Info */}
                  <div className="min-w-0 flex-1">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {review.patient_name}
                        </h2>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(review.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {renderStars(review.rating)}

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            review.status === "pending"
                              ? "bg-orange-100 text-orange-700"
                              : review.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {review.status.toUpperCase()}
                        </span>
                      </div>

                    </div>

                    <p className="mt-5 leading-7 text-gray-600">
                      “{review.comment}”
                    </p>

                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 lg:w-56 lg:justify-end">

                    {review.status !== "approved" && (
                      <button
                        onClick={() =>
                          updateReviewStatus(
                            review.id,
                            "approved"
                          )
                        }
                        disabled={actionLoading === review.id}
                        className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === review.id
                          ? "Saving..."
                          : "Approve"}
                      </button>
                    )}

                    {review.status !== "rejected" && (
                      <button
                        onClick={() =>
                          updateReviewStatus(
                            review.id,
                            "rejected"
                          )
                        }
                        disabled={actionLoading === review.id}
                        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === review.id
                          ? "Saving..."
                          : "Reject"}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        deleteReview(review.id)
                      }
                      disabled={actionLoading === review.id}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </div>

            ))

          )}

        </div>

      </main>
    </div>
  );
}