"use client";

import { useState } from "react";

type Task = {
  id: number;
  title: string;
  subject: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  completed: boolean;
};

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Biology Chapter 7 Quiz",
    subject: "Biology",
    due: "Tomorrow",
    priority: "High",
    completed: false,
  },
  {
    id: 2,
    title: "Math Worksheet 4",
    subject: "Mathematics",
    due: "Thursday",
    priority: "Medium",
    completed: false,
  },
  {
    id: 3,
    title: "History Presentation",
    subject: "History",
    due: "Monday",
    priority: "Medium",
    completed: false,
  },
  {
    id: 4,
    title: "Read English Chapter 12",
    subject: "English",
    due: "Friday",
    priority: "Low",
    completed: true,
  },
];

export default function Home() {
  const [schoolInfo, setSchoolInfo] = useState("");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const completedTasks = tasks.filter((task) => task.completed).length;
  const progress =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks / tasks.length) * 100);

  const nextTask =
    tasks.find((task) => !task.completed && task.priority === "High") ||
    tasks.find((task) => !task.completed);

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  }

  function organizeTasks() {
    if (!schoolInfo.trim()) return;

    setIsOrganizing(true);

    // Temporary demo behavior.
    // We'll replace this with Gemini shortly.
    setTimeout(() => {
      setIsOrganizing(false);
      setShowInput(false);
      setSchoolInfo("");
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="hidden items-center gap-6 text-sm font-medium text-slate-500 sm:flex">
            <span className="text-slate-900">Dashboard</span>
            <span>Tasks</span>
            <span>Progress</span>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            S
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Welcome */}
        <section className="mb-8">
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
              onClick={() => setShowInput(!showInput)}
              className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              + Add schoolwork
            </button>
          </div>
        </section>

        {/* Input panel */}
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
                onChange={(event) => setSchoolInfo(event.target.value)}
                placeholder={`Example:

Math worksheet 4 due Thursday.
Bio quiz Friday on chapter 7.
Don't forget your lab coat tomorrow.
History presentation due Monday.`}
                className="min-h-40 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />

              <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-400">
                  ✨ AI will identify deadlines, subjects, and priorities.
                </p>

                <button
                  onClick={organizeTasks}
                  disabled={!schoolInfo.trim() || isOrganizing}
                  className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isOrganizing ? "Organizing..." : "✨ Organize with AI"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Top cards */}
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Next task */}
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
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                    <div>
                      <p className="text-sm text-slate-400">Recommended</p>
                      <p className="font-semibold">Study for 25 minutes</p>
                    </div>

                    <button
                      onClick={() => toggleTask(nextTask.id)}
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
                    >
                      Start task →
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

          {/* Progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              TODAY&apos;S PROGRESS
            </p>

            <div className="mt-6 flex items-end justify-between">
              <span className="text-5xl font-bold tracking-tight">
                {progress}%
              </span>

              <span className="pb-1 text-sm text-slate-400">
                {completedTasks}/{tasks.length} complete
              </span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-4 text-sm text-slate-500">
              {progress >= 100
                ? "Amazing work. Everything is done!"
                : "Keep going. Small progress adds up."}
            </p>
          </div>
        </section>

        {/* Tasks */}
        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Your schoolwork</h3>
              <p className="mt-1 text-sm text-slate-500">
                Everything in one place.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              {tasks.length} tasks
            </span>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
              />
            ))}
          </div>
        </section>

        {/* Bottom AI callout */}
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
              onClick={() => setShowInput(true)}
              className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Try SchoolSync →
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 text-center text-sm text-slate-400">
          SchoolSync • Built for students, by students.
        </footer>
      </div>
    </main>
  );
}

function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: () => void;
}) {
  const priorityClasses = {
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