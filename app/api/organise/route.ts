import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Get API key
    // --------------------------------------------------

    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY is not configured.");

      return NextResponse.json(
        {
          error:
            "Gemini API key is missing. Add GEMINI_API_KEY to .env.local.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 2. Read request
    // --------------------------------------------------

    const body = await req.json();

    const { schoolInfo } = body;

    if (
      typeof schoolInfo !== "string" ||
      schoolInfo.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Please provide schoolInfo as a non-empty string.",
        },
        { status: 400 }
      );
    }

    // Prevent accidentally sending enormous requests.
    const cleanedSchoolInfo = schoolInfo.trim().slice(0, 12000);

    // --------------------------------------------------
    // 3. Create Gemini client
    // --------------------------------------------------

    const ai = new GoogleGenAI({
      apiKey,
    });

    // --------------------------------------------------
    // 4. Prompt
    // --------------------------------------------------

    const today = new Date().toISOString().split("T")[0];

    const prompt = `
You are SchoolSync, an AI assistant that organizes messy school information
into a clear student task list.

Today's date is ${today}.

The student may paste:
- assignments
- homework
- quizzes
- exams
- projects
- reminders
- teacher announcements
- deadlines
- school events
- supplies they need to bring
- general school instructions

Your job is to extract actionable items from the student's text.

IMPORTANT RULES:

1. Do not invent assignments that are not present in the input.
2. Preserve the meaning of the student's original information.
3. Convert relative dates such as "tomorrow", "Friday", or "next Monday"
   into useful human-readable due labels.
4. If no date is given, use "No deadline".
5. Determine the subject when it is obvious.
6. If the subject cannot be determined, use "General".
7. Assign a priority:
   - High = urgent, important, exam/quiz soon, or deadline very close.
   - Medium = normal upcoming schoolwork.
   - Low = less urgent or flexible work.
8. Estimate how many minutes a student might reasonably need.
9. Keep task titles short and clear.
10. Extract reminders such as "bring lab coat" as tasks when they are actionable.
11. Do not create duplicate tasks.
12. Choose one task as the recommended next task.
13. Explain briefly why that task should be done next.
14. Return ONLY the structured JSON requested by the schema.

STUDENT'S SCHOOL INFORMATION:

${cleanedSchoolInfo}
`;

    // --------------------------------------------------
    // 5. Ask Gemini for structured JSON
    // --------------------------------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,

      config: {
        temperature: 0.2,

        responseMimeType: "application/json",

        responseSchema: {
          type: Type.OBJECT,

          properties: {
            tasks: {
              type: Type.ARRAY,

              items: {
                type: Type.OBJECT,

                properties: {
                  title: {
                    type: Type.STRING,
                  },

                  subject: {
                    type: Type.STRING,
                  },

                  due: {
                    type: Type.STRING,
                  },

                  priority: {
                    type: Type.STRING,
                    enum: ["High", "Medium", "Low"],
                  },

                  estimatedMinutes: {
                    type: Type.NUMBER,
                  },

                  reason: {
                    type: Type.STRING,
                  },
                },

                required: [
                  "title",
                  "subject",
                  "due",
                  "priority",
                  "estimatedMinutes",
                  "reason",
                ],
              },
            },

            nextTaskIndex: {
              type: Type.NUMBER,
            },

            nextTaskReason: {
              type: Type.STRING,
            },

            summary: {
              type: Type.STRING,
            },
          },

          required: [
            "tasks",
            "nextTaskIndex",
            "nextTaskReason",
            "summary",
          ],
        },
      },
    });

    // --------------------------------------------------
    // 6. Parse Gemini response
    // --------------------------------------------------

    const text = response.text;

    if (!text) {
      console.error("❌ Gemini returned an empty response.");

      return NextResponse.json(
        {
          error: "Gemini returned an empty response.",
        },
        { status: 502 }
      );
    }

    let data: any;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini JSON:", text);

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 7. Validate the response
    // --------------------------------------------------

    if (!Array.isArray(data.tasks)) {
      return NextResponse.json(
        {
          error: "Gemini returned an invalid task list.",
        },
        { status: 502 }
      );
    }

    // Clean and normalize tasks before sending them to frontend.
    const tasks = data.tasks
      .filter(
        (task: any) =>
          task &&
          typeof task.title === "string" &&
          task.title.trim().length > 0
      )
      .map((task: any, index: number) => ({
        id: Date.now() + index,

        title: task.title.trim(),

        subject:
          typeof task.subject === "string" && task.subject.trim()
            ? task.subject.trim()
            : "General",

        due:
          typeof task.due === "string" && task.due.trim()
            ? task.due.trim()
            : "No deadline",

        priority:
          task.priority === "High" ||
          task.priority === "Medium" ||
          task.priority === "Low"
            ? task.priority
            : "Medium",

        estimatedMinutes:
          typeof task.estimatedMinutes === "number" &&
          Number.isFinite(task.estimatedMinutes)
            ? Math.max(
                5,
                Math.min(600, Math.round(task.estimatedMinutes))
              )
            : 30,

        reason:
          typeof task.reason === "string" && task.reason.trim()
            ? task.reason.trim()
            : "Upcoming schoolwork.",

        completed: false,
      }));

    // --------------------------------------------------
    // 8. Determine recommended task
    // --------------------------------------------------

    let nextTaskIndex =
      typeof data.nextTaskIndex === "number"
        ? Math.floor(data.nextTaskIndex)
        : 0;

    if (tasks.length === 0) {
      nextTaskIndex = -1;
    } else if (
      nextTaskIndex < 0 ||
      nextTaskIndex >= tasks.length
    ) {
      nextTaskIndex = 0;
    }

    const nextTask =
      nextTaskIndex >= 0 ? tasks[nextTaskIndex] : null;

    const nextTaskReason =
      typeof data.nextTaskReason === "string"
        ? data.nextTaskReason.trim()
        : nextTask
        ? nextTask.reason
        : "No urgent tasks were found.";

    const summary =
      typeof data.summary === "string"
        ? data.summary.trim()
        : `Found ${tasks.length} school task${
            tasks.length === 1 ? "" : "s"
          }.`;

    // --------------------------------------------------
    // 9. Return clean response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      tasks,

      nextTask,

      nextTaskReason,

      summary,

      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("💥 SCHOOLSYNC API ERROR:", error);

    const message =
      error?.message || "Something went wrong while organizing your schoolwork.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}