"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ==================================================
   TYPES & CONSTANTS
================================================== */

type Priority = "High" | "Medium" | "Low";

type Task = {
  id: number;
  title: string;
  subject: string;
  due: string;
  priority: Priority;
  estimatedMinutes?: number;
  reason?: string;
  completed: boolean;
  /** Always a normalized YYYY-MM-DD string, or undefined if the task has no usable date. */
  scheduledDate?: string;
};

const STORAGE_KEY = "schoolsync-tasks";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const PRIORITY_ORDER: Record<Priority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

/* ==================================================
   DATE HELPERS (pure functions - no React hooks here)
================================================== */

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getStartOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** Builds a Date only if the y/m/d combination is a real calendar date. */
function buildValidDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const MONTH_PATTERN =
  "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

const WEEKDAY_PATTERNS: RegExp[] = [
  /\b(sunday|sun)\b/,
  /\b(monday|mon)\b/,
  /\b(tuesday|tues|tue)\b/,
  /\b(wednesday|wed)\b/,
  /\b(thursday|thurs|thur|thu)\b/,
  /\b(friday|fri)\b/,
  /\b(saturday|sat)\b/,
];

/**
 * Converts free-text dates (from the AI or the user) into YYYY-MM-DD.
 *
 * Handles: ISO dates, "Oct 2", "2nd October 2026", "today", "tomorrow",
 * "day after tomorrow", weekday names ("Friday", "next fri").
 *
 * `now` is passed in so the function stays pure and testable.
 */
function parseDateText(
  input: string | undefined | null,
  now: Date = new Date()
): string | undefined {
  if (!input) return undefined;

  const text = String(input).trim().toLowerCase();
  if (!text || text === "no deadline" || text === "none" || text === "n/a") {
    return undefined;
  }

  const today = startOfDay(now);

  /* ISO: 2026-10-02 or 2026-10-02T00:00:00 or 2026/10/02 */
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const date = buildValidDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return formatDate(date);
  }

  /* Month-name dates: "oct 2", "october 2nd, 2026", "2 oct", "2nd of october" */
  const monthFirst = text.match(
    new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`)
  );
  const dayFirst = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_PATTERN}(?:,?\\s+(\\d{4}))?\\b`)
  );

  let monthIndex: number | null = null;
  let dayOfMonth: number | null = null;
  let explicitYear: number | null = null;

  if (monthFirst) {
    monthIndex = MONTH_NAMES.indexOf(monthFirst[1]);
    dayOfMonth = Number(monthFirst[2]);
    explicitYear = monthFirst[3] ? Number(monthFirst[3]) : null;
  } else if (dayFirst) {
    dayOfMonth = Number(dayFirst[1]);
    monthIndex = MONTH_NAMES.indexOf(dayFirst[2]);
    explicitYear = dayFirst[3] ? Number(dayFirst[3]) : null;
  }

  if (monthIndex !== null && monthIndex >= 0 && dayOfMonth !== null) {
    const year = explicitYear ?? today.getFullYear();
    let date = buildValidDate(year, monthIndex + 1, dayOfMonth);

    // No year given and the date is well in the past -> the student means next year.
    if (date && explicitYear === null) {
      const cutoff = addDays(today, -60);
      if (date < cutoff) {
        date = buildValidDate(year + 1, monthIndex + 1, dayOfMonth);
      }
    }

    if (date) return formatDate(date);
  }

  /* Relative words. "day after tomorrow" MUST be checked before "tomorrow". */
  if (text.includes("day after tomorrow")) {
    return formatDate(addDays(today, 2));
  }

  if (text.includes("tomorrow")) {
    return formatDate(addDays(today, 1));
  }

  if (/\btoday\b|\btonight\b/.test(text)) {
    return formatDate(today);
  }

  /* Weekdays: always the NEXT occurrence (a task due "Monday" on a Monday means next week) */
  for (let i = 0; i < WEEKDAY_PATTERNS.length; i++) {
    if (WEEKDAY_PATTERNS[i].test(text)) {
      let difference = i - today.getDay();
      if (difference <= 0) difference += 7;
      return formatDate(addDays(today, difference));
    }
  }

  return undefined;
}

/** Turns a YYYY-MM-DD string into a local Date (avoids the UTC parsing trap). */
function dateFromKey(key: string): Date | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return buildValidDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/* ==================================================
   TASK HELPERS
================================================== */

function normalizePriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "Medium";
}

/**
 * Builds a clean Task from unknown data (localStorage or the AI).
 * The scheduled date is resolved ONCE here and then stored, so a task due
 * "Friday" doesn't drift to a different date every day.
 */
function normalizeTask(raw: any, id: number, now: Date): Task {
  const due = String(raw?.due || "No deadline");

  const existingIso =
    typeof raw?.scheduledDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.scheduledDate) &&
    dateFromKey(raw.scheduledDate)
      ? raw.scheduledDate
      : undefined;

  const scheduledDate =
    existingIso ?? parseDateText(raw?.scheduledDate, now) ?? parseDateText(due, now);

  return {
    id,
    title: String(raw?.title || "Untitled task"),
    subject: String(raw?.subject || "General"),
    due,
    priority: normalizePriority(raw?.priority),
    estimatedMinutes:
      typeof raw?.estimatedMinutes === "number" && raw.estimatedMinutes > 0
        ? raw.estimatedMinutes
        : 30,
    reason: typeof raw?.reason === "string" ? raw.reason : undefined,
    completed: Boolean(raw?.completed),
    scheduledDate,
  };
}

function taskKey(task: { title: string; subject: string }): string {
  return `${task.title.toLowerCase().trim()}|${task.subject.toLowerCase().trim()}`;
}

function createDefaultTasks(now: Date): Task[] {
  const base = [
    {
      title: "Biology Chapter 7 Quiz",
      subject: "Biology",
      due: "Tomorrow",
      priority: "High",
      estimatedMinutes: 25,
      reason: "Upcoming assessment.",
      completed: false,
    },
    {
      title: "Math Worksheet 4",
      subject: "Mathematics",
      due: "Thursday",
      priority: "Medium",
      estimatedMinutes: 30,
      reason: "Upcoming assignment.",
      completed: false,
    },
    {
      title: "History Presentation",
      subject: "History",
      due: "Monday",
      priority: "Medium",
      estimatedMinutes: 45,
      reason: "Upcoming presentation.",
      completed: false,
    },
    {
      title: "Read English Chapter 12",
      subject: "English",
      due: "Friday",
      priority: "Low",
      estimatedMinutes: 25,
      reason: "Reading assignment.",
      completed: true,
    },
  ];

  return base.map((task, index) => normalizeTask(task, index + 1, now));
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* ==================================================
   MAIN COMPONENT
================================================== */

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Set on the client only, so server and client markup match (no hydration errors).
  const [todayKey, setTodayKey] = useState("");
  const [greeting, setGreeting] = useState("Hello");

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const nextId = useRef(1);

  function allocateId(): number {
    const id = nextId.current;
    nextId.current += 1;
    return id;
  }

  /* ==================================================
     CLIENT-ONLY CLOCK VALUES
  ================================================== */

  useEffect(() => {
    const now = new Date();
    setTodayKey(formatDate(now));
    setGreeting(getGreeting(now.getHours()));
  }, []);

  /* ==================================================
     LOAD TASKS
  ================================================== */

  useEffect(() => {
    const now = new Date();
    let initial: Task[] = createDefaultTasks(now);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          initial = parsed.map((task: any, index: number) =>
            normalizeTask(
              task,
              typeof task?.id === "number" ? task.id : index + 1,
              now
            )
          );
        }
      }
    } catch (err) {
      console.error("Could not load saved tasks:", err);
    }

    // Guarantee unique ids and make sure new ids never collide with old ones.
    const seen = new Set<number>();
    let maxId = 0;
    for (const task of initial) maxId = Math.max(maxId, task.id);
    initial = initial.map((task) => {
      if (seen.has(task.id)) {
        maxId += 1;
        task = { ...task, id: maxId };
      }
      seen.add(task.id);
      return task;
    });

    nextId.current = maxId + 1;
    setTasks(initial);
    setLoaded(true);
  }, []);

  /* ==================================================
     SAVE TASKS
  ================================================== */

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error("Could not save tasks:", err);
    }
  }, [tasks, loaded]);

  /* ==================================================
     PROGRESS
  ================================================== */

  const completedTasks = tasks.filter((task) => task.completed).length;

  const progress =
    tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  /* ==================================================
     RECOMMENDED TASK
     Priority first, then earliest date. Undated tasks last.
  ================================================== */

  const nextTask = useMemo(() => {
    const incomplete = tasks.filter((task) => !task.completed);
    if (incomplete.length === 0) return null;

    return [...incomplete].sort((a, b) => {
      const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (byPriority !== 0) return byPriority;

      const dateA = a.scheduledDate ?? "9999-99-99";
      const dateB = b.scheduledDate ?? "9999-99-99";
      return dateA.localeCompare(dateB);
    })[0];
  }, [tasks]);

  /* ==================================================
     TASK ACTIONS
  ================================================== */

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function removeTask(id: number) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  /* ==================================================
     ORGANIZE WITH AI
  ================================================== */

  async function organizeTasks() {
    if (!schoolInfo.trim()) {
      setError("Paste some school information first.");
      return;
    }

    setError("");
    setNotice("");
    setIsOrganizing(true);

    try {
      const response = await fetch("/api/organise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolInfo: schoolInfo.trim(),
          // The server runs in UTC, so tell it the student's local date.
          today: formatDate(new Date()),
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server sent back something unreadable. Try again.");
      }

      if (!response.ok) {
        throw new Error(
          data?.error || "Something went wrong while organizing your work."
        );
      }

      if (!Array.isArray(data?.tasks)) {
        throw new Error("The AI returned an invalid task list.");
      }

      const now = new Date();

      const incoming: Task[] = data.tasks.map((raw: any) =>
        normalizeTask(raw, allocateId(), now)
      );

      // Remove duplicates against existing tasks AND within the incoming batch.
      let addedCount = 0;
      let firstNewDate: string | undefined;

      setTasks((current) => {
        const existing = new Set(current.map(taskKey));
        const fresh: Task[] = [];

        for (const task of incoming) {
          const key = taskKey(task);
          if (existing.has(key)) continue;
          existing.add(key);
          fresh.push(task);
        }

        addedCount = fresh.length;
        firstNewDate = fresh.find((task) => task.scheduledDate)?.scheduledDate;

        return [...current, ...fresh];
      });

      setSchoolInfo("");
      setShowInput(false);

      // Jump the calendar to the earliest new dated task.
      const earliest = [...incoming]
        .map((task) => task.scheduledDate)
        .filter((value): value is string => Boolean(value))
        .sort()[0];

      const target = earliest ?? firstNewDate;
      const targetDate = target ? dateFromKey(target) : null;

      if (targetDate) {
        setCalendarMonth(
          new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
        );
      }

      setNotice(
        incoming.length === 0
          ? "No tasks were found in that text."
          : data.fallback
          ? "The AI was unavailable, so tasks were added with basic parsing. Double-check the subjects and dates."
          : "Tasks added. Anything that already existed was skipped."
      );
    } catch (err: any) {
      console.error("SchoolSync AI error:", err);
      setError(
        err?.message ||
          "Could not organize your schoolwork. Please try again."
      );
    } finally {
      setIsOrganizing(false);
    }
  }

  /* ==================================================
     CALENDAR
  ================================================== */

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );

    const start = getStartOfWeek(firstDay);
    const days: Date[] = [];

    for (let i = 0; i < 42; i++) {
      days.push(addDays(start, i));
    }

    return days;
  }, [calendarMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};

    for (const task of tasks) {
      if (!task.scheduledDate) continue;

      if (!map[task.scheduledDate]) {
        map[task.scheduledDate] = [];
      }

      map[task.scheduledDate].push(task);
    }

    return map;
  }, [tasks]);

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !task.scheduledDate),
    [tasks]
  );

  // Tasks shown in the list: dated ones by date, undated ones last.
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const dateA = a.scheduledDate ?? "9999-99-99";
      const dateB = b.scheduledDate ?? "9999-99-99";
      const byDate = dateA.localeCompare(dateB);
      if (byDate !== 0) return byDate;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
  }, [tasks]);

  const monthName = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function previousMonth() {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }

  function todayMonth() {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  /* ==================================================
     RENDER
  ================================================== */

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] text-slate-500">
        Loading your schoolwork…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* NAVIGATION */}

      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => goTo("dashboard")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              S
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">SchoolSync</h1>
              <p className="text-xs text-slate-500">Your school life, in sync.</p>
            </div>
          </button>

          <div className="hidden items-center gap-6 text-sm font-medium sm:flex">
            {[
              ["dashboard", "Dashboard"],
              ["tasks", "Tasks"],
              ["calendar", "Calendar"],
              ["progress", "Progress"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => goTo(id)}
                className="text-slate-600 transition hover:text-indigo-600"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            S
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ==================================================
            DASHBOARD
        ================================================== */}

        <section id="dashboard" className="scroll-mt-28">
          <div className="mb-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
                  Student dashboard
                </p>

                <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                  {greeting} 👋
                </h2>

                <p className="mt-3 max-w-2xl text-lg text-slate-500">
                  Here&apos;s what needs your attention today.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowInput(!showInput);
                  setError("");
                  setNotice("");
                }}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                + Add schoolwork
              </button>
            </div>
          </div>

          {notice && !showInput && (
            <div
              role="status"
              className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
                className="ml-4 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* AI INPUT */}

          {showInput && (
            <section className="mb-8 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-lg font-bold">Add school information</p>

                <p className="mt-1 text-sm text-slate-500">
                  Paste an assignment, announcement, email, or messy list.
                  SchoolSync will organize it for you.
                </p>
              </div>

              <div className="p-6">
                <textarea
                  value={schoolInfo}
                  onChange={(event) => {
                    setSchoolInfo(event.target.value);
                    setError("");
                  }}
                  placeholder={`Example:

Math worksheet 4 due Thursday.
Bio quiz Friday on chapter 7.
Don't forget your lab coat tomorrow.
History presentation due Monday.`}
                  className="min-h-40 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                />

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    ⚠️ {error}
                  </div>
                )}

                <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-400">
                    ✨ AI will identify deadlines, subjects, and priorities.
                  </p>

                  <button
                    onClick={organizeTasks}
                    disabled={!schoolInfo.trim() || isOrganizing}
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isOrganizing ? "✨ Organizing..." : "✨ Organize with AI"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TOP CARDS */}

          <section className="grid gap-5 lg:grid-cols-3">
            {/* NEXT TASK */}

            <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg lg:col-span-2">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl" />

              <div className="relative">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      WHAT SHOULD I DO NOW?
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Highest priority first, then earliest date
                    </p>
                  </div>

                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-300">
                    🔥 NEXT UP
                  </span>
                </div>

                {nextTask ? (
                  <>
                    <h3 className="text-2xl font-bold sm:text-3xl">
                      {nextTask.title}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-300">
                        {nextTask.subject}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-300">
                        Due {nextTask.due}
                      </span>

                      {!!nextTask.estimatedMinutes && (
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-300">
                          ~{nextTask.estimatedMinutes} min
                        </span>
                      )}
                    </div>

                    {nextTask.reason && (
                      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                        {nextTask.reason}
                      </p>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                      <div>
                        <p className="text-sm text-slate-400">Recommended</p>
                        <p className="font-semibold">Start with this task</p>
                      </div>

                      <button
                        onClick={() => toggleTask(nextTask.id)}
                        className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
                      >
                        Mark done ✓
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 className="text-2xl font-bold">
                      You&apos;re all caught up! 🎉
                    </h3>

                    <p className="mt-2 text-slate-400">
                      Nothing urgent needs your attention.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* PROGRESS */}

            <div
              id="progress"
              className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-500">
                OVERALL PROGRESS
              </p>

              <div className="mt-6 flex items-end justify-between">
                <span className="text-5xl font-bold tracking-tight">
                  {progress}%
                </span>

                <span className="pb-1 text-sm text-slate-400">
                  {completedTasks}/{tasks.length} complete
                </span>
              </div>

              <div
                className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-4 text-sm text-slate-500">
                {tasks.length === 0
                  ? "Add some schoolwork to start tracking."
                  : progress >= 100
                  ? "Amazing work. Everything is done!"
                  : "Keep going. Small progress adds up."}
              </p>
            </div>
          </section>
        </section>

        {/* ==================================================
            TASKS
        ================================================== */}

        <section id="tasks" className="mt-12 scroll-mt-28">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Your schoolwork</h3>
              <p className="mt-1 text-sm text-slate-500">
                Everything in one place.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-4xl">📚</div>

              <h4 className="mt-4 font-bold">No schoolwork yet</h4>

              <p className="mt-2 text-sm text-slate-500">
                Add an assignment or announcement to get started.
              </p>

              <button
                onClick={() => setShowInput(true)}
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                Add schoolwork
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  overdue={
                    !task.completed &&
                    !!task.scheduledDate &&
                    !!todayKey &&
                    task.scheduledDate < todayKey
                  }
                  onToggle={() => toggleTask(task.id)}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ==================================================
            CALENDAR
        ================================================== */}

        <section
          id="calendar"
          className="mt-12 scroll-mt-28 rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Your schedule
                </p>

                <h3 className="mt-1 text-2xl font-bold">{monthName}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={todayMonth}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Today
                </button>

                <button
                  onClick={previousMonth}
                  aria-label="Previous month"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg hover:bg-slate-50"
                >
                  ←
                </button>

                <button
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg hover:bg-slate-50"
                >
                  →
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {/* WEEKDAYS */}

            <div className="grid grid-cols-7 border-b border-slate-100 pb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* DAYS */}

            <div className="grid grid-cols-7">
              {calendarDays.map((date) => {
                const dateKey = formatDate(date);

                const isCurrentMonth =
                  date.getMonth() === calendarMonth.getMonth() &&
                  date.getFullYear() === calendarMonth.getFullYear();

                const isToday = dateKey === todayKey;
                const dayTasks = tasksByDate[dateKey] || [];

                return (
                  <div
                    key={dateKey}
                    className={`min-h-28 min-w-0 border-b border-r border-slate-100 p-1.5 sm:min-h-32 sm:p-2 ${
                      isCurrentMonth ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <div
                      className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-indigo-600 text-white"
                          : isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                      }`}
                    >
                      {date.getDate()}
                    </div>

                    <div className="space-y-1">
                      {dayTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          title={`${task.title} — click to ${
                            task.completed ? "mark incomplete" : "mark complete"
                          }`}
                          className={`w-full break-words rounded-lg p-1.5 text-left text-[10px] font-semibold transition sm:text-xs ${
                            task.completed
                              ? "bg-slate-100 text-slate-400 line-through"
                              : task.priority === "High"
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : task.priority === "Medium"
                              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* UNSCHEDULED */}

          {unscheduledTasks.length > 0 && (
            <div className="border-t border-slate-200 p-5">
              <h4 className="font-bold text-slate-800">📌 Unscheduled tasks</h4>

              <p className="mt-1 text-sm text-slate-500">
                These tasks don&apos;t have a recognizable calendar date yet.
              </p>

              <div className="mt-3 space-y-2">
                {unscheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{task.title}</p>

                      <p className="text-xs text-slate-400">
                        {task.subject} • Due {task.due}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleTask(task.id)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-slate-200"
                    >
                      {task.completed ? "Done" : "Mark done"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            AI CALLOUT
        ================================================== */}

        <section className="mt-10 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-600 shadow-sm">
                ✨ SCHOOLSYNC AI
              </div>

              <h3 className="text-2xl font-bold text-slate-950">
                Stop organizing. Start learning.
              </h3>

              <p className="mt-2 max-w-2xl text-slate-600">
                Paste your messy school information and let SchoolSync turn it
                into a clear plan you can actually follow.
              </p>
            </div>

            <button
              onClick={() => {
                setShowInput(true);
                goTo("dashboard");
              }}
              className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Try SchoolSync →
            </button>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="py-10 text-center text-sm text-slate-400">
          SchoolSync • Built for students, by students.
        </footer>
      </div>
    </main>
  );
}

/* ==================================================
   TASK CARD
================================================== */

function TaskCard({
  task,
  overdue,
  onToggle,
  onRemove,
}: {
  task: Task;
  overdue: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const priorityClasses: Record<Priority, string> = {
    High: "bg-red-50 text-red-600",
    Medium: "bg-amber-50 text-amber-600",
    Low: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div
      className={`group flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${
        task.completed
          ? "border-slate-100 opacity-60"
          : overdue
          ? "border-red-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={onToggle}
          aria-label={
            task.completed ? "Mark task incomplete" : "Mark task complete"
          }
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            task.completed
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-300 hover:border-indigo-500"
          }`}
        >
          {task.completed && <span className="text-xs">✓</span>}
        </button>

        <div>
          <h4
            className={`font-semibold ${
              task.completed ? "text-slate-400 line-through" : "text-slate-900"
            }`}
          >
            {task.title}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{task.subject}</span>
            <span>•</span>
            <span>Due {task.due}</span>

            {!!task.estimatedMinutes && (
              <>
                <span>•</span>
                <span>{task.estimatedMinutes} min</span>
              </>
            )}

            {overdue && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                Overdue
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
            priorityClasses[task.priority]
          }`}
        >
          {task.priority} priority
        </span>

        <button
          onClick={onRemove}
          aria-label={`Remove ${task.title}`}
          className="rounded-lg px-2 py-1 text-sm text-slate-300 transition hover:bg-red-50 hover:text-red-500 focus:text-red-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
