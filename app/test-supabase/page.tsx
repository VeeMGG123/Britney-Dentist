"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestSupabase() {
  const [message, setMessage] = useState("جاري الاتصال...");

  useEffect(() => {
    const test = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("services")
        .select("*");

      if (error) {
        setMessage("❌ حصل خطأ: " + error.message);
        return;
      }

      setMessage(`✅ الاتصال شغال — عدد الخدمات: ${data.length}`);
    };

    test();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1 className="text-3xl font-bold">{message}</h1>
    </main>
  );
}