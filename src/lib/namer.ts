// src/lib/namer.ts
import { createClient } from "@/providers/client";

type GenNameOpts = {
  apiUrl: string;
  apiKey?: string | null;
  assistantId?: string | null; // nếu server dùng assistant-scoped experiments
};

// Bật log debug khi cần: NEXT_PUBLIC_DEBUG_NAMER=1
const DEBUG_NAMER = process.env.NEXT_PUBLIC_DEBUG_NAMER === "1";

function pickTitle(out: any): string | null {
  const candidates = [
    out?.["Thread Name"],
    out?.thread_name,
    out?.name,
    out?.title,
  ];
  const found = candidates.find(
    (v) => typeof v === "string" && v.trim().length > 0
  );
  return found ? String(found).trim() : null;
}

export async function generateThreadName(
  { apiUrl, apiKey, assistantId }: GenNameOpts,
  initialMessage: string
): Promise<string | null> {
  const client = createClient(apiUrl, apiKey ?? undefined);
  const input = { "Initial Message": initialMessage };

  try {
    // 1) Ưu tiên assistant-scoped (nếu server/SDK hỗ trợ)
    const hasAssistantScoped =
      (client as any).assistants?.experiments?.run &&
      typeof (client as any).assistants.experiments.run === "function";

    if (hasAssistantScoped && assistantId) {
      const res = await (client as any).assistants.experiments.run(
        assistantId,
        "generate_name",
        { input }
      );
      const title = pickTitle(res?.output ?? {});
      if (DEBUG_NAMER) console.info("[namer] assistant-scoped title:", title);
      if (title) return title;
    }

    // 2) Thử global /experiments nếu server có
    const hasGlobal =
      (client as any).experiments?.run &&
      typeof (client as any).experiments.run === "function";

    if (hasGlobal) {
      const res = await (client as any).experiments.run("generate_name", {
        input,
      });
      const title = pickTitle(res?.output ?? {});
      if (DEBUG_NAMER) console.info("[namer] global title:", title);
      if (title) return title;
    }
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    // 404 -> server không có route -> fallback im lặng
    if (status === 404) {
      if (DEBUG_NAMER) {
        console.info(
          "[namer] experiments endpoint not found on",
          apiUrl,
          "-> fallback local"
        );
      }
      return null;
    }
    // Lỗi khác bubble lên để nhìn rõ khi có vấn đề thực sự
    throw e;
  }

  if (DEBUG_NAMER) {
    console.info("[namer] experiments API not available -> fallback local");
  }
  return null;
}
