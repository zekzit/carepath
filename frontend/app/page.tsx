"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Hackathon Starter
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">Next.js + Django + SQLite</p>
      <p className="text-sm">
        Backend status:{" "}
        {status === "loading" && <span className="text-zinc-500">checking...</span>}
        {status === "ok" && <span className="text-green-600">connected</span>}
        {status === "error" && (
          <span className="text-red-600">not reachable (is the Django server running?)</span>
        )}
      </p>
    </div>
  );
}
