"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Priority = "High" | "Medium" | "Low";

type Task = {
  id: number;
  title: string;
  subject: string;
  due: string;
  dueDate?: string;
  priority: Priority;
  estimatedMinutes?: number;
  reason?: string;
  completed: boolean;
};

type FlowStep = {
  step: number;
  title: string;
  description: string;
};

type RevisionQuestion = {
  question: string;
  answer: string;
};

type StudyAnalysis = {
  summary: string;
  keyPoints: string[];
  flowchart: FlowStep[];
  questions: RevisionQuestion[];
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

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getNextWeekday(weekday: number, from = new Date()) {
  const today = startOfDay(from);
  const current = today.getDay();

  let difference = weekday - current;

  if (difference <= 0) difference += 7;

  return addDays(today, difference);
}

function parseDueDate(due: string): string | undefined {
  if (!due) return undefined;

  const normalized = due
    .toLowerCase()
    .trim()
    .replace(/\./g, "");

  const today = startOfDay(new Date());

  if (
    normalized === "today" ||
    normalized.includes("due today")
  ) {
    return toDateKey(today);
  }

  if (
    normalized === "tomorrow" ||
    normalized.includes("due tomorrow")
  ) {
    return toDateKey(addDays(today, 1));
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (
      normalized === WEEKDAYS[i] ||
      normalized.includes(WEEKDAYS[i])
    ) {
      return toDateKey(getNextWeekday(i, today));
    }
  }

  const monthAliases: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  const monthPattern =
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})/i;

  const reversedPattern =
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i;

  let match = normalized.match(monthPattern);

  let monthName: string | undefined;
  let dayNumber: number | undefined;

  if (match) {
    monthName = match[1];
    dayNumber = Number(match[2]);
  } else {
    match = normalized.match(reversedPattern);

    if (match) {
      dayNumber = Number(match[1]);
      monthName = match[2];
    }
  }

  if (monthName && dayNumber) {
    const month = monthAliases[monthName];

    if (
      month !== undefined &&
      dayNumber >= 1 &&
      dayNumber <= 31
    ) {
      let year = today.getFullYear();

      let candidate = new Date(
        year,
        month,
        dayNumber
      );

      if (candidate < today) {
        year++;
        candidate = new Date(
          year,
          month,
          dayNumber
        );
      }

      return toDateKey(candidate);
    }
  }

  const numericMatch = normalized.match(
    /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
  );

  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);

    let year = numericMatch[3]
      ? Number(numericMatch[3])
      : today.getFullYear();

    if (year < 100) year += 2000;

    let month = first;
    let day = second;

    if (first > 12) {
      day = first;
      month = second;
    }

    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const candidate = new Date(
        year,
        month - 1,
        day
      );

      if (!numericMatch[3] && candidate < today) {
        candidate.setFullYear(year + 1);
      }

      return toDateKey(candidate);
    }
  }

  return undefined;
}

function getTaskDate(task: Task) {
  return task.dueDate || parseDueDate(task.due);
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [error, setError] = useState("");

  const [calendarMonth, setCalendarMonth] =
    useState(new Date());

  const [selectedDate, setSelectedDate] =
    useState(new Date());

  /* =====================================================
     STUDY AI
  ===================================================== */

  const [studyNotes, setStudyNotes] = useState("");
  const [studyFiles, setStudyFiles] = useState<File[]>([]);
  const [studyAnalysis, setStudyAnalysis] =
    useState<StudyAnalysis | null>(null);

  const [isAnalyzingStudy, setIsAnalyzingStudy] =
    useState(false);

  const [studyError, setStudyError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* =====================================================
     LOAD TASKS
  ===================================================== */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setTasks(parsed);
          setHasLoadedTasks(true);
          return;
        }
      }

      setTasks(defaultTasks);
    } catch {
      setTasks(defaultTasks);
    }

    setHasLoadedTasks(true);
  }, []);

  /* =====================================================
     SAVE TASKS
  ===================================================== */

  useEffect(() => {
    if (!hasLoadedTasks) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
      );
    } catch (err) {
      console.error("Could not save tasks:", err);
    }
  }, [tasks, hasLoadedTasks]);

  /* =====================================================
     PROGRESS
  ===================================================== */

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round(
          (completedTasks / tasks.length) * 100
        );

  /* =====================================================
     NEXT TASK
  ===================================================== */

  const nextTask = useMemo(() => {
    const incomplete = tasks.filter(
      (task) => !task.completed
    );

    if (!incomplete.length) return null;

    const priorityOrder: Record<Priority, number> = {
      High: 0,
      Medium: 1,
      Low: 2,
    };

    return [...incomplete].sort((a, b) => {
      const priorityDifference =
        priorityOrder[a.priority] -
        priorityOrder[b.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const dateA = getTaskDate(a);
      const dateB = getTaskDate(b);

      if (dateA && dateB) {
        return dateA.localeCompare(dateB);
      }

      return 0;
    })[0];
  }, [tasks]);

  /* =====================================================
     TASK ACTIONS
  ===================================================== */

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

  /* =====================================================
     SCHOOLWORK AI
  ===================================================== */

  async function organizeTasks() {
    if (!schoolInfo.trim()) {
      setError("Paste some school information first.");
      return;
    }

    setError("");
    setIsOrganizing(true);

    try {
      const response = await fetch("/api/organise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "tasks",
          schoolInfo: schoolInfo.trim(),
        }),
      });

      const responseText = await response.text();

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned an invalid response: ${responseText.slice(
            0,
            200
          )}`
        );
      }

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
          (task: any, index: number) => {
            const due = String(
              task.due || "No deadline"
            );

            return {
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

              due,

              dueDate:
                typeof task.dueDate === "string"
                  ? task.dueDate
                  : parseDueDate(due),

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
            };
          }
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

        const newTasks = incomingTasks.filter(
          (task) => {
            const key =
              `${task.title
                .toLowerCase()
                .trim()}|${task.subject
                .toLowerCase()
                .trim()}`;

            if (existingKeys.has(key)) {
              return false;
            }

            existingKeys.add(key);
            return true;
          }
        );

        return [...current, ...newTasks];
      });

      setSchoolInfo("");
      setShowInput(false);
    } catch (err: any) {
      setError(
        err?.message ||
          "Could not organize your schoolwork."
      );
    } finally {
      setIsOrganizing(false);
    }
  }

  /* =====================================================
     STUDY FILES
  ===================================================== */

  function addStudyFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected = Array.from(
      event.target.files || []
    );

    if (!selected.length) return;

    setStudyFiles((current) => [
      ...current,
      ...selected,
    ]);

    event.target.value = "";
    setStudyError("");
  }

  function removeStudyFile(index: number) {
    setStudyFiles((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  /* =====================================================
     STUDY ANALYSIS
  ===================================================== */

  async function analyzeStudyMaterial(
    event?: FormEvent
  ) {
    event?.preventDefault();

    if (
      !studyNotes.trim() &&
      studyFiles.length === 0
    ) {
      setStudyError(
        "Paste your notes or attach some study material first."
      );
      return;
    }

    setStudyError("");
    setStudyAnalysis(null);
    setIsAnalyzingStudy(true);

    try {
      const formData = new FormData();

      formData.append("mode", "study");

      formData.append(
        "notes",
        studyNotes.trim()
      );

      studyFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(
        "/api/organise",
        {
          method: "POST",
          body: formData,
        }
      );

      const responseText = await response.text();

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned an invalid response: ${responseText.slice(
            0,
            250
          )}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "AI analysis failed."
        );
      }

      if (
        !data.summary ||
        !Array.isArray(data.keyPoints) ||
        !Array.isArray(data.flowchart) ||
        !Array.isArray(data.questions)
      ) {
        throw new Error(
          "The AI returned an incomplete study analysis."
        );
      }

      setStudyAnalysis(data);
    } catch (err: any) {
      console.error(
        "Study analysis error:",
        err
      );

      setStudyError(
        err?.message ||
          "Could not analyze the study material."
      );
    } finally {
      setIsAnalyzingStudy(false);
    }
  }

  /* =====================================================
     CALENDAR
  ===================================================== */

  const calendarDays = useMemo(() => {
    const year =
      calendarMonth.getFullYear();

    const month =
      calendarMonth.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const startingDay =
      firstDay.getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const previousMonthDays =
      new Date(
        year,
        month,
        0
      ).getDate();

    const days: {
      date: Date;
      currentMonth: boolean;
    }[] = [];

    for (
      let i = startingDay - 1;
      i >= 0;
      i--
    ) {
      days.push({
        date: new Date(
          year,
          month - 1,
          previousMonthDays - i
        ),
        currentMonth: false,
      });
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push({
        date: new Date(
          year,
          month,
          day
        ),
        currentMonth: true,
      });
    }

    let nextDay = 1;

    while (days.length < 42) {
      days.push({
        date: new Date(
          year,
          month + 1,
          nextDay++
        ),
        currentMonth: false,
      });
    }

    return days;
  }, [calendarMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const task of tasks) {
      const date = getTaskDate(task);

      if (!date) continue;

      if (!map.has(date)) {
        map.set(date, []);
      }

      map.get(date)!.push(task);
    }

    return map;
  }, [tasks]);

  const selectedDateKey =
    toDateKey(selectedDate);

  const selectedTasks =
    tasksByDate.get(selectedDateKey) || [];

  const unscheduledTasks =
    tasks.filter(
      (task) => !getTaskDate(task)
    );

  function goToPreviousMonth() {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  }

  function goToNextMonth() {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      )
    );
  }

  function goToToday() {
    const today = new Date();

    setCalendarMonth(today);
    setSelectedDate(today);
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">

      {/* NAV */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              S
            </div>

            <div>
              <h1 className="text-lg font-bold">
                SchoolSync
              </h1>

              <p className="text-xs text-slate-500">
                Your school life, in sync.
              </p>
            </div>
          </div>

          <div className="hidden gap-6 text-sm font-medium text-slate-500 sm:flex">
            <span className="text-slate-900">
              Dashboard
            </span>
            <span>Tasks</span>
            <span>Calendar</span>
            <span>Progress</span>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
            S
          </div>

        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* HEADER */}
        <section className="mb-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">

            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
                Student dashboard
              </p>

              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
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
              className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              + Add schoolwork
            </button>

          </div>
        </section>

        {/* =====================================================
            EXISTING SCHOOLWORK AI
        ===================================================== */}

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
                className="min-h-40 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
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
                  className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isOrganizing
                    ? "✨ Organizing..."
                    : "✨ Organize with AI"}
                </button>

              </div>
            </div>
          </section>
        )}

        {/* =====================================================
            TOP CARDS
        ===================================================== */}

        <section className="grid gap-5 lg:grid-cols-3">

          <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg lg:col-span-2">

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
                      <p className="text-sm text-slate-400">
                        Recommended
                      </p>

                      <p className="font-semibold">
                        Start with this task
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        toggleTask(nextTask.id)
                      }
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100"
                    >
                      Mark done ✓
                    </button>

                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold">
                    You&apos;re all caught up! 🎉
                  </h3>

                  <p className="mt-2 text-slate-400">
                    Nothing urgent needs your attention.
                  </p>
                </>
              )}

            </div>
          </div>

          {/* PROGRESS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <p className="text-sm font-semibold text-slate-500">
              TODAY&apos;S PROGRESS
            </p>

            <div className="mt-6 flex items-end justify-between">

              <span className="text-5xl font-bold">
                {progress}%
              </span>

              <span className="pb-1 text-sm text-slate-400">
                {completedTasks}/{tasks.length} complete
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

        {/* =====================================================
            CALENDAR
        ===================================================== */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Your schedule
                </p>

                <h3 className="mt-1 text-2xl font-bold">
                  {formatMonth(calendarMonth)}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Every scheduled task in one place.
                </p>
              </div>

              <div className="flex items-center gap-2">

                <button
                  onClick={goToToday}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Today
                </button>

                <button
                  onClick={goToPreviousMonth}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg hover:bg-slate-50"
                >
                  ←
                </button>

                <button
                  onClick={goToNextMonth}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg hover:bg-slate-50"
                >
                  →
                </button>

              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">

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
                className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400"
              >
                {day}
              </div>
            ))}

          </div>

          <div className="grid grid-cols-7">

            {calendarDays.map(
              ({ date, currentMonth }) => {
                const key = toDateKey(date);

                const dayTasks =
                  tasksByDate.get(key) || [];

                const isToday = isSameDay(
                  date,
                  new Date()
                );

                const isSelected = isSameDay(
                  date,
                  selectedDate
                );

                return (
                  <button
                    key={key}
                    onClick={() =>
                      setSelectedDate(date)
                    }
                    className={`min-h-28 border-b border-r border-slate-100 p-2 text-left transition hover:bg-indigo-50/50 ${
                      !currentMonth
                        ? "bg-slate-50/60"
                        : "bg-white"
                    } ${
                      isSelected
                        ? "ring-2 ring-inset ring-indigo-500"
                        : ""
                    }`}
                  >

                    <div className="flex items-center justify-between">

                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : currentMonth
                            ? "text-slate-700"
                            : "text-slate-300"
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-bold text-indigo-500">
                          {dayTasks.length}
                        </span>
                      )}

                    </div>

                    <div className="mt-2 space-y-1">

                      {dayTasks
                        .slice(0, 3)
                        .map((task) => (
                          <div
                            key={task.id}
                            className={`truncate rounded-md px-1.5 py-1 text-[10px] font-semibold ${
                              task.completed
                                ? "bg-slate-100 text-slate-400 line-through"
                                : task.priority ===
                                  "High"
                                ? "bg-red-50 text-red-600"
                                : task.priority ===
                                  "Medium"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {task.title}
                          </div>
                        ))}

                      {dayTasks.length > 3 && (
                        <div className="px-1 text-[10px] font-semibold text-slate-400">
                          +{dayTasks.length - 3} more
                        </div>
                      )}

                    </div>

                  </button>
                );
              }
            )}

          </div>

          {/* SELECTED DAY */}

          <div className="border-t border-slate-200 bg-slate-50 p-5">

            <div className="mb-4 flex items-center justify-between">

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Selected day
                </p>

                <h4 className="mt-1 text-lg font-bold">
                  {selectedDate.toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </h4>
              </div>

              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
                {selectedTasks.length}{" "}
                {selectedTasks.length === 1
                  ? "task"
                  : "tasks"}
              </span>

            </div>

            {selectedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <div className="text-2xl">
                  🌤️
                </div>

                <p className="mt-2 text-sm font-semibold">
                  Nothing scheduled
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  This day is clear.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">

                {selectedTasks.map((task) => (
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

          </div>
        </section>

        {/* =====================================================
            UNSCHEDULED
        ===================================================== */}

        {unscheduledTasks.length > 0 && (
          <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <h4 className="font-bold text-amber-900">
              📌 Unscheduled tasks
            </h4>

            <p className="mt-1 text-sm text-amber-700">
              These tasks could not be converted
              into a calendar date.
            </p>

            <div className="mt-4 space-y-2">

              {unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-xl bg-white p-3"
                >

                  <div>
                    <p className="text-sm font-semibold">
                      {task.title}
                    </p>

                    <p className="text-xs text-slate-400">
                      {task.subject} • Due {task.due}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      toggleTask(task.id)
                    }
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"
                  >
                    {task.completed
                      ? "Done"
                      : "Mark done"}
                  </button>

                </div>
              ))}

            </div>
          </section>
        )}

        {/* =====================================================
            ALL TASKS
        ===================================================== */}

        <section className="mt-8">

          <div className="mb-5 flex items-center justify-between">

            <div>
              <h3 className="text-2xl font-bold">
                Your schoolwork
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Everything in one place.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              {tasks.length} tasks
            </span>

          </div>

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

        </section>

        {/* =====================================================
            NEW AI STUDY ORGANIZER
        ===================================================== */}

        <section
          id="ai-study"
          className="mt-10 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm"
        >

          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white sm:p-8">

            <div className="max-w-3xl">

              <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                ✨ NEW • SCHOOLSYNC AI
              </div>

              <h3 className="text-3xl font-bold">
                Turn long notes into a study guide.
              </h3>

              <p className="mt-3 leading-7 text-indigo-100">
                Paste your notes or upload PDFs,
                screenshots, handwritten notes and
                text files. AI will summarize them,
                find the important concepts, build a
                learning flowchart and create revision
                questions.
              </p>

            </div>

          </div>

          <form
            onSubmit={analyzeStudyMaterial}
            className="p-6 sm:p-8"
          >

            <textarea
              value={studyNotes}
              onChange={(e) => {
                setStudyNotes(e.target.value);
                setStudyError("");
              }}
              placeholder="Paste a long essay, lecture notes, textbook notes, or anything you need to study..."
              className="min-h-64 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-5 leading-7 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            />

            {/* FILE INPUTS */}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="hidden"
              onChange={addStudyFiles}
            />

            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={addStudyFiles}
            />

            <div className="mt-5 flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold hover:bg-slate-50"
              >
                📎 Attach files
              </button>

              <button
                type="button"
                onClick={() =>
                  imageInputRef.current?.click()
                }
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                🖼️ Add photos
              </button>

              <button
                type="submit"
                disabled={
                  isAnalyzingStudy ||
                  (!studyNotes.trim() &&
                    studyFiles.length === 0)
                }
                className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzingStudy
                  ? "✨ Analyzing..."
                  : "✨ Analyze my notes"}
              </button>

            </div>

            <p className="mt-3 text-xs text-slate-400">
              Supports PDF, TXT, Markdown and images.
            </p>

            {/* ATTACHMENTS */}

            {studyFiles.length > 0 && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">

                <p className="mb-3 text-sm font-bold">
                  Attached material ({studyFiles.length})
                </p>

                <div className="space-y-2">

                  {studyFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-xl bg-white p-3"
                    >

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {file.name}
                        </p>

                        <p className="text-xs text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeStudyFile(index)
                        }
                        className="ml-3 rounded-lg px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                      >
                        Remove
                      </button>

                    </div>
                  ))}

                </div>
              </div>
            )}

            {studyError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                ⚠️ {studyError}
              </div>
            )}

          </form>
        </section>

        {/* =====================================================
            STUDY RESULTS
        ===================================================== */}

        {studyAnalysis && (
          <section className="mt-6 space-y-5">

            {/* SUMMARY */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                📚 Summary
              </p>

              <p className="mt-4 whitespace-pre-line text-lg leading-8 text-slate-700">
                {studyAnalysis.summary}
              </p>

            </div>

            {/* KEY CONCEPTS */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                🎯 Key concepts
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">

                {studyAnalysis.keyPoints.map(
                  (point, index) => (
                    <div
                      key={index}
                      className="rounded-2xl bg-slate-50 p-5"
                    >

                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                        {index + 1}
                      </div>

                      <p className="leading-7 text-slate-700">
                        {point}
                      </p>

                    </div>
                  )
                )}

              </div>
            </div>

            {/* FLOWCHART */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                🔀 Learning flowchart
              </p>

              <div className="mt-6 space-y-3">

                {studyAnalysis.flowchart.map(
                  (item, index) => (
                    <div key={index}>

                      <div className="flex gap-4 rounded-2xl bg-slate-50 p-5">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">
                          {item.step}
                        </div>

                        <div>
                          <h4 className="font-bold">
                            {item.title}
                          </h4>

                          <p className="mt-1 leading-7 text-slate-600">
                            {item.description}
                          </p>
                        </div>

                      </div>

                      {index <
                        studyAnalysis.flowchart
                          .length -
                          1 && (
                        <div className="py-2 text-center text-xl text-indigo-400">
                          ↓
                        </div>
                      )}

                    </div>
                  )
                )}

              </div>
            </div>

            {/* QUESTIONS */}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                🧠 Revision questions
              </p>

              <div className="mt-6 space-y-3">

                {studyAnalysis.questions.map(
                  (item, index) => (
                    <details
                      key={index}
                      className="group rounded-2xl border border-slate-200 bg-slate-50"
                    >

                      <summary className="cursor-pointer list-none p-5 font-semibold">
                        <div className="flex gap-3">

                          <span className="font-bold text-indigo-600">
                            {index + 1}.
                          </span>

                          <span className="flex-1">
                            {item.question}
                          </span>

                          <span className="text-slate-400 group-open:rotate-180">
                            ↓
                          </span>

                        </div>
                      </summary>

                      <div className="border-t border-slate-200 px-5 pb-5 pt-4 leading-7 text-slate-600">
                        <strong className="text-slate-900">
                          Answer:
                        </strong>{" "}
                        {item.answer}
                      </div>

                    </details>
                  )
                )}

              </div>
            </div>

          </section>
        )}

        {/* FOOTER */}

        <footer className="py-10 text-center text-sm text-slate-400">
          SchoolSync • Built for students, by students.
        </footer>

      </div>
    </main>
  );
}

/* =====================================================
   TASK CARD
===================================================== */

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
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
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