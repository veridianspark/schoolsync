"use client";

import { useEffect, useMemo, useState } from "react";

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
  scheduledDate?: string;
};

const STORAGE_KEY = "schoolsync-tasks";

const defaultTasks: Task[] = [
  {
    id: 1,
    title: "Biology Chapter 7 Quiz",
    subject: "Biology",
    due: "Tomorrow",
    priority: "High",
    estimatedMinutes: 25,
    reason: "Upcoming assessment.",
    completed: false,
  },
  {
    id: 2,
    title: "Math Worksheet 4",
    subject: "Mathematics",
    due: "Thursday",
    priority: "Medium",
    estimatedMinutes: 30,
    reason: "Upcoming assignment.",
    completed: false,
  },
  {
    id: 3,
    title: "History Presentation",
    subject: "History",
    due: "Monday",
    priority: "Medium",
    estimatedMinutes: 45,
    reason: "Upcoming presentation.",
    completed: false,
  },
  {
    id: 4,
    title: "Read English Chapter 12",
    subject: "English",
    due: "Friday",
    priority: "Low",
    estimatedMinutes: 25,
    reason: "Reading assignment.",
    completed: true,
  },
];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();

  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);

  return result;
}

function getDateFromDue(due: string): string | undefined {
  const text = due.trim().toLowerCase();
  const today = new Date();

  if (!text || text === "no deadline") {
    return undefined;
  }

  // ISO date such as 2026-09-28
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (text.includes("today")) {
    return formatDate(today);
  }

  if (text.includes("tomorrow")) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  }

  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  for (let i = 0; i < weekdays.length; i++) {
    if (text.includes(weekdays[i])) {
      const currentDay = today.getDay();
      let difference = i - currentDay;

      if (difference <= 0) {
        difference += 7;
      }

      const date = new Date(today);
      date.setDate(date.getDate() + difference);

      return formatDate(date);
    }
  }

  // Try parsing normal date strings
  const parsed = new Date(due);

  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  return undefined;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schoolInfo, setSchoolInfo] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  // --------------------------------------------------
  // LOAD TASKS
  // --------------------------------------------------

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setTasks(parsed);
        } else {
          setTasks(defaultTasks);
        }
      } else {
        setTasks(defaultTasks);
      }
    } catch (err) {
      console.error("Could not load saved tasks:", err);
      setTasks(defaultTasks);
    } finally {
      setLoaded(true);
    }
  }, []);

  // --------------------------------------------------
  // SAVE TASKS
  // --------------------------------------------------

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error("Could not save tasks:", err);
    }
  }, [tasks, loaded]);

  // --------------------------------------------------
  // PROGRESS
  // --------------------------------------------------

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round(
          (completedTasks / tasks.length) * 100
        );

  // --------------------------------------------------
  // RECOMMENDED TASK
  // --------------------------------------------------

  const nextTask = useMemo(() => {
    const incomplete = tasks.filter(
      (task) => !task.completed
    );

    if (incomplete.length === 0) return null;

    const priorityOrder: Record<Priority, number> = {
      High: 0,
      Medium: 1,
      Low: 2,
    };

    return [...incomplete].sort(
      (a, b) =>
        priorityOrder[a.priority] -
        priorityOrder[b.priority]
    )[0];
  }, [tasks]);

  // --------------------------------------------------
  // TOGGLE TASK
  // --------------------------------------------------

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
            }
          : task
      )
    );
  }

  // --------------------------------------------------
  // SCROLL NAVIGATION
  // --------------------------------------------------

  function goTo(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  // --------------------------------------------------
  // ORGANIZE WITH GEMINI
  // --------------------------------------------------

  async function organizeTasks() {
    if (!schoolInfo.trim()) {
      setError(
        "Paste some school information first."
      );
      return;
    }

    setError("");
    setIsOrganizing(true);

    try {
      const response = await fetch(
        "/api/organise",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolInfo: schoolInfo.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Something went wrong while organizing your work."
        );
      }

      if (!Array.isArray(data.tasks)) {
        throw new Error(
          "The AI returned an invalid task list."
        );
      }

      const incomingTasks: Task[] =
        data.tasks.map(
          (task: any, index: number) => ({
            id:
              Date.now() +
              index +
              Math.floor(Math.random() * 1000),

            title: String(
              task.title || "Untitled task"
            ),

            subject: String(
              task.subject || "General"
            ),

            due: String(
              task.due || "No deadline"
            ),

            priority:
              task.priority === "High" ||
              task.priority === "Medium" ||
              task.priority === "Low"
                ? task.priority
                : "Medium",

            estimatedMinutes:
              typeof task.estimatedMinutes ===
              "number"
                ? task.estimatedMinutes
                : 30,

            reason:
              typeof task.reason === "string"
                ? task.reason
                : "Upcoming schoolwork.",

            completed: false,

            scheduledDate:
              typeof task.scheduledDate ===
              "string"
                ? task.scheduledDate
                : getDateFromDue(
                    String(
                      task.due ||
                        "No deadline"
                    )
                  ),
          })
        );

      setTasks((current) => {
        const existingKeys = new Set(
          current.map(
            (task) =>
              `${task.title
                .toLowerCase()
                .trim()}|${task.subject
                .toLowerCase()
                .trim()}`
          )
        );

        const newTasks =
          incomingTasks.filter((task) => {
            const key = `${task.title
              .toLowerCase()
              .trim()}|${task.subject
              .toLowerCase()
              .trim()}`;

            if (existingKeys.has(key)) {
              return false;
            }

            existingKeys.add(key);

            return true;
          });

        return [...current, ...newTasks];
      });

      setSchoolInfo("");
      setShowInput(false);

      // Show the month containing the first
      // newly-created scheduled task.
      const firstDate =
        incomingTasks.find(
          (task) => task.scheduledDate
        )?.scheduledDate;

      if (firstDate) {
        const date = new Date(
          `${firstDate}T00:00:00`
        );

        if (!Number.isNaN(date.getTime())) {
          setCalendarMonth(
            new Date(
              date.getFullYear(),
              date.getMonth(),
              1
            )
          );
        }
      }
    } catch (err: any) {
      console.error(
        "SchoolSync AI error:",
        err
      );

      setError(
        err?.message ||
          "Could not organize your schoolwork. Please try again."
      );
    } finally {
      setIsOrganizing(false);
    }
  }

  // --------------------------------------------------
  // CALENDAR
  // --------------------------------------------------

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );

    const lastDay = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );

    const start = getStartOfWeek(firstDay);

    const days: Date[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }

    return days;
  }, [calendarMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};

    for (const task of tasks) {
      const date =
        task.scheduledDate ||
        getDateFromDue(task.due);

      if (!date) continue;

      if (!map[date]) {
        map[date] = [];
      }

      map[date].push(task);
    }

    return map;
  }, [tasks]);

  const monthName =
    calendarMonth.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );

  function previousMonth() {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }

  function nextMonth() {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }

  function todayMonth() {
    const today = new Date();

    setCalendarMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
  }

  const todayKey = formatDate(new Date());

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

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
              <h1 className="text-lg font-bold tracking-tight">
                SchoolSync
              </h1>

              <p className="text-xs text-slate-500">
                Your school life, in sync.
              </p>
            </div>
          </button>

          <div className="hidden items-center gap-6 text-sm font-medium sm:flex">
            <button
              onClick={() => goTo("dashboard")}
              className="text-slate-600 transition hover:text-indigo-600"
            >
              Dashboard
            </button>

            <button
              onClick={() => goTo("tasks")}
              className="text-slate-600 transition hover:text-indigo-600"
            >
              Tasks
            </button>

            <button
              onClick={() => goTo("calendar")}
              className="text-slate-600 transition hover:text-indigo-600"
            >
              Calendar
            </button>

            <button
              onClick={() => goTo("progress")}
              className="text-slate-600 transition hover:text-indigo-600"
            >
              Progress
            </button>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            S
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* DASHBOARD */}
        <section id="dashboard">
          <div className="mb-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
                  Student dashboard
                </p>

                <h2 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                  Good afternoon 👋
                </h2>

                <p className="mt-3 max-w-2xl text-lg text-slate-500">
                  Here&apos;s what needs your attention today.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowInput(!showInput);
                  setError("");
                }}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                + Add schoolwork
              </button>
            </div>
          </div>

          {/* AI INPUT */}
          {showInput && (
            <section className="mb-8 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-lg font-bold">
                  Add school information
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Paste an assignment, announcement,
                  email, or messy list. SchoolSync
                  will organize it for you.
                </p>
              </div>

              <div className="p-6">
                <textarea
                  value={schoolInfo}
                  onChange={(event) => {
                    setSchoolInfo(
                      event.target.value
                    );
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
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    ⚠️ {error}
                  </div>
                )}

                <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="text-xs text-slate-400">
                    ✨ AI will identify deadlines,
                    subjects, and priorities.
                  </p>

                  <button
                    onClick={organizeTasks}
                    disabled={
                      !schoolInfo.trim() ||
                      isOrganizing
                    }
                    className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isOrganizing
                      ? "✨ Organizing..."
                      : "✨ Organize with AI"}
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
                      Based on urgency and priority
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

                      {nextTask.estimatedMinutes && (
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-300">
                          ~
                          {
                            nextTask.estimatedMinutes
                          }{" "}
                          min
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
                        <p className="text-sm text-slate-400">
                          Recommended
                        </p>

                        <p className="font-semibold">
                          Start with this task
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          toggleTask(
                            nextTask.id
                          )
                        }
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
                TODAY&apos;S PROGRESS
              </p>

              <div className="mt-6 flex items-end justify-between">
                <span className="text-5xl font-bold tracking-tight">
                  {progress}%
                </span>

                <span className="pb-1 text-sm text-slate-400">
                  {completedTasks}/
                  {tasks.length} complete
                </span>
              </div>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p className="mt-4 text-sm text-slate-500">
                {progress >= 100
                  ? "Amazing work. Everything is done!"
                  : "Keep going. Small progress adds up."}
              </p>
            </div>
          </section>
        </section>

        {/* TASKS */}
        <section
          id="tasks"
          className="mt-12 scroll-mt-28"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">
                Your schoolwork
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Everything in one place.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              {tasks.length} tasks
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-4xl">📚</div>

              <h4 className="mt-4 font-bold">
                No schoolwork yet
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Add an assignment or announcement
                to get started.
              </p>

              <button
                onClick={() =>
                  setShowInput(true)
                }
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                Add schoolwork
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() =>
                    toggleTask(task.id)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* CALENDAR */}
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

                <h3 className="mt-1 text-2xl font-bold">
                  {monthName}
                </h3>
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
              {[
                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
              ].map((day) => (
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
                const dateKey =
                  formatDate(date);

                const isCurrentMonth =
                  date.getMonth() ===
                    calendarMonth.getMonth() &&
                  date.getFullYear() ===
                    calendarMonth.getFullYear();

                const isToday =
                  dateKey === todayKey;

                const dayTasks =
                  tasksByDate[dateKey] || [];

                return (
                  <div
                    key={dateKey}
                    className={`min-h-28 border-b border-r border-slate-100 p-1.5 sm:min-h-32 sm:p-2 ${
                      isCurrentMonth
                        ? "bg-white"
                        : "bg-slate-50/60"
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
                      {dayTasks.map(
                        (task) => (
                          <button
                            key={task.id}
                            onClick={() =>
                              toggleTask(
                                task.id
                              )
                            }
                            title={`${task.title} — click to ${
                              task.completed
                                ? "mark incomplete"
                                : "mark complete"
                            }`}
                            className={`w-full rounded-lg p-1.5 text-left text-[10px] font-semibold transition sm:text-xs ${
                              task.completed
                                ? "bg-slate-100 text-slate-400 line-through"
                                : task.priority ===
                                  "High"
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : task.priority ===
                                  "Medium"
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {task.title}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* UNSCHEDULED */}
          {tasks.some(
            (task) =>
              !(
                task.scheduledDate ||
                getDateFromDue(task.due)
              )
          ) && (
            <div className="border-t border-slate-200 p-5">
              <h4 className="font-bold text-slate-800">
                📌 Unscheduled tasks
              </h4>

              <p className="mt-1 text-sm text-slate-500">
                These tasks don&apos;t have a
                recognizable calendar date yet.
              </p>

              <div className="mt-3 space-y-2">
                {tasks
                  .filter(
                    (task) =>
                      !(
                        task.scheduledDate ||
                        getDateFromDue(task.due)
                      )
                  )
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {task.title}
                        </p>

                        <p className="text-xs text-slate-400">
                          {task.subject} • Due{" "}
                          {task.due}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          toggleTask(
                            task.id
                          )
                        }
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-slate-200"
                      >
                        {task.completed
                          ? "Done"
                          : "Mark done"}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* AI CALLOUT */}
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
                Paste your messy school
                information and let SchoolSync
                turn it into a clear plan you
                can actually follow.
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

        <footer className="py-10 text-center text-sm text-slate-400">
          SchoolSync • Built for students, by students.
        </footer>
      </div>
    </main>
  );
}

// ==================================================
// TASK CARD
// ==================================================

function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const priorityClasses: Record<
    Priority,
    string
  > = {
    High: "bg-red-50 text-red-600",
    Medium: "bg-amber-50 text-amber-600",
    Low: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div
      className={`group flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${
        task.completed
          ? "border-slate-100 opacity-60"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={onToggle}
          aria-label={
            task.completed
              ? "Mark task incomplete"
              : "Mark task complete"
          }
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            task.completed
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-300 hover:border-indigo-500"
          }`}
        >
          {task.completed && (
            <span className="text-xs">
              ✓
            </span>
          )}
        </button>

        <div>
          <h4
            className={`font-semibold ${
              task.completed
                ? "text-slate-400 line-through"
                : "text-slate-900"
            }`}
          >
            {task.title}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{task.subject}</span>

            <span>•</span>

            <span>Due {task.due}</span>

            {task.estimatedMinutes && (
              <>
                <span>•</span>
                <span>
                  {task.estimatedMinutes} min
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <span
        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
          priorityClasses[task.priority]
        }`}
      >
        {task.priority} priority
      </span>
    </div>
  );
}