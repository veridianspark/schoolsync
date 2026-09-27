import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY;

const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

async function callGemini(
  parts: GeminiPart[]
) {
  if (!API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${text.slice(0, 500)}`
    );
  }

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini returned an invalid response."
    );
  }

  const output =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("")
      .trim();

  if (!output) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return output;
}

function cleanJson(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/* =====================================================
   TASK ORGANIZER
===================================================== */

async function organizeTasks(
  schoolInfo: string
) {
  const prompt = `
You are SchoolSync, an AI schoolwork organizer.

Analyze the student's school information below and
extract every meaningful school task, assignment,
quiz, test, presentation, reading, project, deadline,
or other actionable schoolwork item.

Return ONLY valid JSON.

Use exactly this structure:

{
  "tasks": [
    {
      "title": "short task title",
      "subject": "subject",
      "due": "human-readable deadline",
      "dueDate": "YYYY-MM-DD or empty string if unknown",
      "priority": "High | Medium | Low",
      "estimatedMinutes": 30,
      "reason": "short explanation"
    }
  ]
}

Rules:
- Do not invent deadlines.
- If a deadline is not provided, use "No deadline".
- Infer the subject only when it is reasonably clear.
- High priority means urgent, soon, or an important assessment.
- Medium means a normal upcoming assignment.
- Low means less urgent.
- estimatedMinutes should be a reasonable estimate.
- Extract multiple tasks when multiple tasks are present.
- Keep titles concise.
- Return an empty tasks array if there are no actionable tasks.

Student information:

${schoolInfo}
`;

  const output = await callGemini([
    {
      text: prompt,
    },
  ]);

  const parsed = JSON.parse(
    cleanJson(output)
  );

  if (!Array.isArray(parsed.tasks)) {
    throw new Error(
      "AI returned an invalid task list."
    );
  }

  return parsed;
}

/* =====================================================
   STUDY MATERIAL ANALYZER
===================================================== */

async function analyzeStudyMaterial(
  notes: string,
  files: File[]
) {
  const parts: GeminiPart[] = [];

  const prompt = `
You are SchoolSync AI, a study assistant.

Analyze the student's study material carefully.

The material may contain:
- pasted notes
- textbook material
- lecture notes
- essays
- PDFs
- screenshots
- photographs of handwritten notes
- TXT files
- Markdown files

Your job is to transform the supplied material into
a useful study guide.

IMPORTANT:
- Base the response on the supplied material.
- Do not invent facts that are not supported by it.
- Preserve important terminology from the material.
- Do not omit major concepts merely to make the response shorter.
- If something is unclear in the material, say so rather than guessing.
- Make the explanation suitable for a student.

Return ONLY valid JSON with exactly this structure:

{
  "summary": "A clear but detailed summary of the material.",
  "keyPoints": [
    "Important concept 1",
    "Important concept 2",
    "Important concept 3"
  ],
  "flowchart": [
    {
      "step": 1,
      "title": "First major concept",
      "description": "Explain what happens or what this concept means."
    },
    {
      "step": 2,
      "title": "Next concept",
      "description": "Explain the relationship to the previous concept."
    }
  ],
  "questions": [
    {
      "question": "A useful revision question.",
      "answer": "The answer based on the supplied material."
    }
  ]
}

Requirements:

SUMMARY
- Explain the central ideas clearly.
- Preserve important details.
- Organize a long essay into understandable sections
  when appropriate.

KEY POINTS
- Extract the most important concepts.
- Include terminology a student should remember.
- Aim for 5-10 useful points when the material supports it.

FLOWCHART
- Show the logical progression of the material.
- Use 4-10 steps when possible.
- Each step must have a meaningful title and explanation.
- If the material describes a process, make the flow follow
  that process.
- If it is conceptual rather than procedural, show the
  relationships between the major ideas.

REVISION QUESTIONS
- Create useful study questions from the supplied material.
- Mix recall and understanding questions.
- Include approximately 5-10 questions when enough material
  is available.
- Answers must be supported by the supplied material.

If the material is very short, return fewer items rather
than inventing information.
`;

  parts.push({
    text: prompt,
  });

  if (notes.trim()) {
    parts.push({
      text: `PASTED STUDY NOTES:\n\n${notes}`,
    });
  }

  /*
   * Gemini can directly understand supported image/PDF
   * content when supplied as inlineData.
   */
  for (const file of files) {
    const arrayBuffer =
      await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    parts.push({
      text: `ATTACHED FILE: ${file.name}`,
    });

    parts.push({
      inlineData: {
        mimeType:
          file.type || "application/octet-stream",
        data: buffer.toString("base64"),
      },
    });
  }

  const output = await callGemini(parts);

  let parsed: any;

  try {
    parsed = JSON.parse(
      cleanJson(output)
    );
  } catch {
    throw new Error(
      "AI returned invalid study-analysis JSON."
    );
  }

  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.keyPoints) ||
    !Array.isArray(parsed.flowchart) ||
    !Array.isArray(parsed.questions)
  ) {
    throw new Error(
      "AI returned an incomplete study analysis."
    );
  }

  return parsed;
}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const contentType =
      request.headers.get("content-type") || "";

    /*
     * EXISTING TASK ORGANIZER
     *
     * page.tsx sends JSON here.
     */
    if (
      contentType.includes(
        "application/json"
      )
    ) {
      const body = await request.json();

      const mode =
        body?.mode || "tasks";

      if (mode !== "tasks") {
        return NextResponse.json(
          {
            error:
              "Invalid JSON request mode.",
          },
          { status: 400 }
        );
      }

      const schoolInfo =
        typeof body?.schoolInfo === "string"
          ? body.schoolInfo.trim()
          : "";

      if (!schoolInfo) {
        return NextResponse.json(
          {
            error:
              "Please provide school information.",
          },
          { status: 400 }
        );
      }

      const result =
        await organizeTasks(
          schoolInfo
        );

      return NextResponse.json(
        result
      );
    }

    /*
     * NEW STUDY ANALYZER
     *
     * page.tsx sends FormData here so it can
     * include notes + images + PDFs + text files.
     */
    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      const mode =
        String(
          formData.get("mode") || ""
        );

      if (mode !== "study") {
        return NextResponse.json(
          {
            error:
              "Invalid study request.",
          },
          { status: 400 }
        );
      }

      const notes =
        String(
          formData.get("notes") || ""
        );

      const files = formData
        .getAll("files")
        .filter(
          (item): item is File =>
            item instanceof File
        );

      if (
        !notes.trim() &&
        files.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Please provide notes or at least one file.",
          },
          { status: 400 }
        );
      }

      /*
       * Prevent unexpectedly huge requests.
       */
      const MAX_FILES = 10;
      const MAX_FILE_SIZE =
        15 * 1024 * 1024;

      if (files.length > MAX_FILES) {
        return NextResponse.json(
          {
            error:
              `You can upload up to ${MAX_FILES} files at once.`,
          },
          { status: 400 }
        );
      }

      for (const file of files) {
        if (
          file.size > MAX_FILE_SIZE
        ) {
          return NextResponse.json(
            {
              error:
                `${file.name} is too large. Please keep files under 15 MB.`,
            },
            { status: 400 }
          );
        }
      }

      const result =
        await analyzeStudyMaterial(
          notes,
          files
        );

      return NextResponse.json(
        result
      );
    }

    return NextResponse.json(
      {
        error:
          "Unsupported request type.",
      },
      { status: 415 }
    );
  } catch (error: any) {
    console.error(
      "SchoolSync API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while processing your request.",
      },
      { status: 500 }
    );
  }
}