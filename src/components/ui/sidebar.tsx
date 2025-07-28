"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquarePlus as NewChatIcon,
  Menu as MenuIcon,
  Search,
  Book as LibraryIcon,
  UserCircle2 as AvatarIcon,
} from "lucide-react";
import { useThreads } from "@/providers/Thread";
import { useQueryState } from "nuqs";
import { getApiKey } from "@/lib/api-key";
import { createClient } from "@/providers/client";

const LogoIcon = AvatarIcon;

function SidebarMenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={cn(
        "flex items-center gap-3 rounded px-3 py-2 transition font-medium text-sm select-none cursor-pointer",
        active
          ? "bg-primary/80 text-primary-foreground"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const {
    threads,
    threadsLoading,
    getThreads,
    setThreads,
    setThreadsLoading,
  } = useThreads();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [apiUrl] = useQueryState("apiUrl");

  useEffect(() => {
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewThread = async () => {
    if (!apiUrl) return;
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      const defaultTitle = `Cuộc trò chuyện ${new Date().toLocaleTimeString()}`;
      const newThread = await client.threads.create({
        metadata: { title: defaultTitle },
      });
      setThreadId(newThread.thread_id);
      setThreads((prev) => [newThread, ...prev]);
    } catch (err) {
      console.error("Failed to create new thread", err);
      alert("Không thể tạo đoạn chat mới!");
    }
  };

  const HISTORY_MAX_HEIGHT = 42 * 10 + 8; // Chiều cao chứa 10 items

  return (
    <aside
      className={cn(
        "flex flex-col min-h-screen w-64 bg-sidebar text-sidebar-foreground",
        className
      )}
      style={{ minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <LogoIcon className="size-7 text-primary" />
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewThread}
            className="p-2 rounded hover:bg-muted"
            aria-label="Đoạn chat mới"
          >
            <NewChatIcon className="size-5" />
          </button>
          <button className="p-2 rounded hover:bg-muted" aria-label="Menu">
            <MenuIcon className="size-5" />
          </button>
        </div>
      </div>

      {/* Menu */}
      <nav className="px-4 py-3 flex flex-col gap-1 border-b border-sidebar-border">
        <SidebarMenuItem
          icon={<NewChatIcon className="size-4" />}
          label="Đoạn chat mới"
          onClick={handleNewThread}
        />
        <SidebarMenuItem icon={<Search className="size-4" />} label="Tìm kiếm đoạn chat" />
        <SidebarMenuItem icon={<LibraryIcon className="size-4" />} label="Thư viện" />
      </nav>

      {/* Lịch sử chat */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 pt-3 pb-2 text-xs uppercase text-muted-foreground font-bold">
          Đoạn chat
        </div>
        <ul
          className="flex flex-col gap-1 overflow-y-auto custom-scrollbar px-2 pb-2"
          style={{ maxHeight: HISTORY_MAX_HEIGHT, minHeight: 0 }}
        >
          {threadsLoading ? (
            <li className="text-xs text-muted-foreground px-2">Loading...</li>
          ) : threads.length === 0 ? (
            <li className="text-xs text-muted-foreground px-2">No history</li>
          ) : (
            threads.map((thread) => {
              const title =
                thread.metadata?.title ||
                (thread.metadata as any)?.name ||
                thread.thread_id;
              const isActive = threadId === thread.thread_id;
              return (
                <li key={thread.thread_id}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setThreadId(thread.thread_id);
                    }}
                    className={cn(
                      "block rounded px-3 py-2 text-sm truncate transition font-medium",
                      isActive
                        ? "bg-primary/80 text-primary-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                    )}
                  >
                    {title}
                  </a>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
}
