# 📚 SchoolSync

### Your school life, in sync.

SchoolSync is an AI-powered student productivity dashboard that turns messy school information into a clear, organized plan.

Students receive assignments, quizzes, presentations, deadlines, and announcements from many different places. SchoolSync brings them together and helps students understand **what needs to be done, when it is due, and what they should work on next.**

---

## ✨ Features

### 🤖 AI Schoolwork Organizer
Paste messy school information such as:

> Biology quiz on Chapter 7 tomorrow.  
> Math worksheet 4 is due Thursday.  
> History presentation is due Monday.

SchoolSync uses Google Gemini to identify:

- 📚 Subject
- 📝 Task
- 📅 Deadline
- 🔥 Priority
- ⏱️ Estimated completion time

### 🎯 Smart Next Task
SchoolSync analyzes your incomplete tasks and recommends what you should work on next based on priority and urgency.

### 📅 Dynamic Calendar
Tasks with recognizable deadlines automatically appear on the calendar, giving students a visual overview of upcoming work.

### ✅ Task Management
Mark tasks as complete or incomplete and keep track of everything from one dashboard.

### 📊 Progress Tracking
See your overall completion percentage and how many tasks you've finished.

### 💾 Persistent Tasks
Tasks are stored locally so refreshing the page doesn't erase your work.

### 🛡️ AI Fallback
If the Gemini API is temporarily unavailable or reaches its quota, SchoolSync can fall back to local task processing so the application remains usable.

---

## 🧠 How It Works

```text
Messy School Information
          ↓
      SchoolSync
          ↓
     Gemini AI
          ↓
 ┌────────┼─────────┐
 ↓        ↓         ↓
Tasks  Deadlines  Priority
          ↓
      Dashboard
          ↓
 ┌────────┼─────────┐
 ↓        ↓         ↓
Tasks   Calendar  Progress
```

Instead of manually organizing every assignment, students can simply provide the information they already have and let SchoolSync structure it.

---

## 🛠️ Tech Stack

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Google Gemini API**
- **Vercel**
- **LocalStorage**

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment variables

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
```

⚠️ **Never commit your API key to GitHub.**

### 4. Run the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 🌐 Deployment

SchoolSync can be deployed using Vercel.

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Add your Gemini environment variables.
4. Deploy.
5. Open your Vercel production URL.

---

## 📂 Project Structure

```text
schoolsync/
├── app/
│   ├── api/
│   │   └── organise/
│   │       └── route.ts
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── public/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 💡 Example

### Input

```text
Biology Chapter 7 quiz tomorrow.
Math worksheet 4 due Friday.
History presentation due Monday.
Read English Chapter 12 by Friday.
```

### SchoolSync

Automatically turns this into structured tasks with:

| Task | Subject | Priority | Deadline |
|---|---|---|---|
| Biology Chapter 7 Quiz | Biology | High | Tomorrow |
| Math Worksheet 4 | Mathematics | Medium | Friday |
| History Presentation | History | Medium | Monday |
| Read English Chapter 12 | English | Low | Friday |

These tasks can then appear in the dashboard and calendar.

---

## 🎯 Why SchoolSync?

Students don't always struggle because they have too much work.

They struggle because their work is **scattered**.

Assignments can arrive through announcements, messages, emails, classroom platforms, notebooks, and conversations.

SchoolSync turns that scattered information into one organized workspace.

> **Spend less time organizing schoolwork. Spend more time learning.**

---

## 🔮 Future Improvements

- 📎 Assignment attachments
- 🖼️ Image and screenshot analysis
- 📝 Long-form note summarization
- 🧠 AI study-plan generation
- 🗺️ Automatic concept flowcharts
- 🌍 Multi-language support
- 🔔 Deadline reminders
- 📆 Google Calendar integration
- 📈 Study analytics
- 👥 Collaborative study planning

---

## 🏆 Hackathon Project

SchoolSync was built to explore how AI can become part of a student's everyday workflow instead of simply acting as a chatbot.

The goal is to make AI **useful, actionable, and simple**.

---

## 👨‍💻 Built With

Built with ❤️ using **Next.js, TypeScript, Tailwind CSS, and Google Gemini.**

### 📚 SchoolSync

**Your school life, in sync.**
