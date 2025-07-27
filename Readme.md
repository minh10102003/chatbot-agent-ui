````markdown
# Agent Chat UI

Agent Chat UI is a Next.js + TypeScript application which enables chatting with any LangGraph server exposing a `messages` key.

---

## Quickstart

### 🎬 Scaffold or Clone

```bash
# Scaffold via NPX
npx create-agent-chat-app

# — or —

git clone https://github.com/minh10102003/chatbot-agent-ui
cd agent-chat-ui
````

### 📦 Install dependencies

```bash
pnpm install
# or
npm install
# or
yarn install
```

### 🛠️ Configure

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=https://your-langgraph-server.com
NEXT_PUBLIC_API_KEY=your_api_key_here   # (if required)
```

> If you don’t have a backend yet, the app will fall back to mocked data.

### 🚀 Run in development

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 🏗️ Build & Preview Production

```bash
pnpm build
pnpm start
```


