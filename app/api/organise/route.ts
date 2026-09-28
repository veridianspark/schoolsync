import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

type Priority = "High" | "Medium" | "Low";

type Task = {
  title: string;
  subject: string;
  due: string;
  scheduledDate?: string;
  priority: Priority;
  estimatedMinutes: number;
  reason: string;
};

const MAX_INPUT_LENGTH = 8000;

// Change this in Vercel Environment Variables if needed.
// Example: GEMINI_MODEL=gemini-3.8-flash
const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

/* =========================================================
   DATE HELPERS
========================================================= */

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function nextWeekday(
  weekday: number,
  from = new Date()
) {
  const today = from.getDay();

  let difference = weekday - today;

  if (difference <= 0) {
    difference += 7;
  }

  return addDays(from, difference);
}

function parseDate(text: string): string | undefined {
  if (!text) return undefined;

  const value = text
    .toLowerCase()
    .replace(/,/g, "")
    .trim();

  const today = new Date();

  if (
    value === "today" ||
    value.includes("today")
  ) {
    return localDateKey(today);
  }

  if (
    value === "tomorrow" ||
    value.includes("tomorrow")
  ) {
    return localDateKey(addDays(today, 1));
  }

  if (value.includes("day after tomorrow")) {
    return localDateKey(addDays(today, 2));
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [name, weekday] of Object.entries(
    weekdays
  )) {
    if (value.includes(name)) {
      return localDateKey(
        nextWeekday(weekday, today)
      );
    }
  }

  const shortDays: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  for (const [name, weekday] of Object.entries(
    shortDays
  )) {
    if (
      value === name ||
      value.includes(`${name} `)
    ) {
      return localDateKey(
        nextWeekday(weekday, today)
      );
    }
  }

  const iso = value.match(
    /\b(\d{4})-(\d{2})-(\d{2})\b/
  );

  if (iso) {
    return iso[0];
  }

  return undefined;
}

/* =========================================================
   LOCAL FALLBACK
   This means the demo still works if Gemini is unavailable.
========================================================= */

function detectSubject(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("biology") ||
    lower.includes("bio")
  ) {
    return "Biology";
  }

  if (
    lower.includes("math") ||
    lower.includes("algebra") ||
    lower.includes("calculus")
  ) {
    return "Mathematics";
  }

  if (
    lower.includes("history") ||
    lower.includes("historical")
  ) {
    return "History";
  }

  if (
    lower.includes("english") ||
    lower.includes("essay") ||
    lower.includes("chapter")
  ) {
    return "English";
  }

  if (
    lower.includes("physics") ||
    lower.includes("physics")
  ) {
    return "Physics";
  }

  if (
    lower.includes("chemistry") ||
    lower.includes("chem")
  ) {
    return "Chemistry";
  }

  if (
    lower.includes("python") ||
    lower.includes("coding") ||
    lower.includes("programming")
  ) {
    return "Computer Science";
  }

  return "General";
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase();

  if (
    lower.includes("urgent") ||
    lower.includes("exam") ||
    lower.includes("quiz") ||
    lower.includes("test") ||
    lower.includes("tomorrow") ||
    lower.includes("today")
  ) {
    return "High";
  }

  if (
    lower.includes("important") ||
    lower.includes("presentation") ||
    lower.includes("project")
  ) {
    return "Medium";
  }

  return "Low";
}

function detectMinutes(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("exam") ||
    lower.includes("quiz") ||
    lower.includes("test")
  ) {
    return 30;
  }

  if (
    lower.includes("presentation") ||
    lower.includes("project")
  ) {
    return 60;
  }

  return 30;
}

function createLocalTask(
  text: string
): Task {
  const clean = text.trim();

  const subject = detectSubject(clean);
  const priority = detectPriority(clean);
  const scheduledDate = parseDate(clean);

  let title = clean
    .replace(
      /\b(due|by|on|tomorrow|today)\b.*$/i,
      ""
    )
    .trim();

  if (!title) {
    title = clean;
  }

  return {
    title:
      title.charAt(0).toUpperCase() +
      title.slice(1),

    subject,

    due: scheduledDate
      ? new Date(
          `${scheduledDate}T00:00:00`
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "No deadline",

    scheduledDate,

    priority,

    estimatedMinutes: detectMinutes(clean),

    reason:
      priority === "High"
        ? "This looks time-sensitive or important."
        : "Added from your school information.",
  };
}

function localFallback(
  schoolInfo: string
): Task[] {
  const lines = schoolInfo
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  return lines
    .slice(0, 20)
    .map(createLocalTask);
}

/* =========================================================
   GEMINI
========================================================= */

async function organizeWithGemini(
  schoolInfo: string
): Promise<Task[]> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const today = localDateKey();

  const prompt = `
You are SchoolSync, an AI school-work organizer.

Today's local date is ${today}.

Turn the student's messy school information into a JSON array of tasks.

Rules:
- Extract every real school task.
- Identify the subject.
- Identify the deadline.
- Convert relative dates such as "today", "tomorrow", and weekdays into YYYY-MM-DD.
- Use the provided today's date when calculating relative dates.
- Do NOT move a task to a different date.
- Priority must be High, Medium, or Low.
- estimatedMinutes must be a number.
- Keep titles short and clear.
- If there is no deadline, scheduledDate should be null.

Return ONLY valid JSON.

Required format:

[
  {
    "title": "Biology Chapter 7 Quiz",
    "subject": "Biology",
    "due": "Sep 29",
    "scheduledDate": "2026-09-29",
    "priority": "High",
    "estimatedMinutes": 30,
    "reason": "Upcoming assessment."
  }
]

Student information:

${schoolInfo}
`;

  const response =
    await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

  const raw = response.text;

  if (!raw) {
    throw new Error("EMPTY_AI_RESPONSE");
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("INVALID_AI_RESPONSE");
  }

  return parsed.map((task: any) => {
    const scheduledDate =
      typeof task.scheduledDate === "string"
        ? task.scheduledDate
        : parseDate(
            String(task.due || "")
          );

    return {
      title: String(
        task.title || "Untitled task"
      ),

      subject: String(
        task.subject || "General"
      ),

      due: String(
        task.due || "No deadline"
      ),

      scheduledDate,

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
    };
  });
}

/* =========================================================
   API
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const schoolInfo =
      typeof body?.schoolInfo === "string"
        ? body.schoolInfo.trim()
        : "";

    if (!schoolInfo) {
      return NextResponse.json(
        {
          error:
            "Please paste some school information.",
        },
        { status: 400 }
      );
    }

    if (
      schoolInfo.length >
      MAX_INPUT_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "Please keep the school information under 8000 characters.",
        },
        { status: 400 }
      );
    }

    let tasks: Task[];
    let usedFallback = false;

    try {
      tasks =
        await organizeWithGemini(
          schoolInfo
        );
    } catch (error: any) {
      console.error(
        "Gemini unavailable:",
        error
      );

      /*
       * IMPORTANT:
       * Do not make the demo fail because of:
       * - 429 quota errors
       * - 503 unavailable errors
       * - temporary model problems
       * - invalid/missing API keys
       */

      usedFallback = true;

      tasks = localFallback(
        schoolInfo
      );
    }

    return NextResponse.json({
      tasks,
      fallback: usedFallback,
      model: usedFallback
        ? "local-fallback"
        : MODEL,
    });
  } catch (error) {
    console.error(
      "SchoolSync API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "SchoolSync could not process that information.",
      },
      { status: 500 }
    );
  }
}