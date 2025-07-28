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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        if (onClick) {
          e.preventDefault();
          onClick();
        }
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

// Helper function để làm sạch và format title
function formatThreadTitle(rawTitle: string): { displayTitle: string; fullTitle: string } {
  // Làm sạch title
  const cleanTitle = rawTitle
    .replace(/^(Tạo website:|Code React component:|Phân tích dữ liệu:|Debug & Sửa lỗi:|Thiết kế UI\/UX:|Lập trình Frontend:|Lập trình Backend:|UI Component:|Trực quan hóa dữ liệu:|Xử lý dữ liệu:|Thiết kế thương hiệu:|Thiết kế layout:|Marketing & SEO:|Email Marketing:|Content Marketing:|Học tập & Hướng dẫn:|Giải thích & Hướng dẫn:|Tối ưu hóa:|Hỗ trợ & Giải đáp:|AI & Chatbot:|Tự động hóa:|Backend Development:)\s*/i, '')
    .replace(/:\s*$/, '') // Xóa dấu : cuối
    .replace(/^[•\-*]\s*/, '') // Xóa bullet points
    .trim();

  // Nếu sau khi clean mà rỗng, dùng original
  const finalTitle = cleanTitle || rawTitle;
  
  // Tạo display title (rút gọn nếu quá dài)
  const displayTitle = finalTitle.length > 28 
    ? finalTitle.slice(0, 28).trim() + "…" 
    : finalTitle;

  return {
    displayTitle,
    fullTitle: finalTitle
  };
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
      .then((list) => setThreads(list))
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tạo thread mới với title mặc định
  const handleNewThread = async () => {
    if (!apiUrl) return;
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      // title mặc định, user vẫn có thể đổi sau
      const defaultTitle = `Đoạn chat ${new Date().toLocaleTimeString()}`;
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

  const HISTORY_MAX_HEIGHT = 42 * 10 + 8;

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
            className="p-2 rounded hover:bg-muted"
            onClick={handleNewThread}
            aria-label="Đoạn chat mới"
          >
            <NewChatIcon className="size-5" />
          </button>
          <button className="p-2 rounded hover:bg-muted" aria-label="Menu">
            <MenuIcon className="size-5" />
          </button>
        </div>
      </div>

      {/* Menu trên */}
      <nav className="px-4 py-3 flex flex-col gap-1 border-b border-sidebar-border">
        <SidebarMenuItem
          icon={<NewChatIcon className="size-4" />}
          label="Đoạn chat mới"
          onClick={handleNewThread}
        />
        <SidebarMenuItem icon={<Search className="size-4" />} label="Tìm kiếm đoạn chat" />
        <SidebarMenuItem icon={<LibraryIcon className="size-4" />} label="Thư viện" />
      </nav>

      {/* Lịch sử đoạn chat */}
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
              // Ưu tiên metadata.title, fallback đến thread_id
              const rawTitle = (thread.metadata as any)?.title || thread.thread_id;
              const { displayTitle, fullTitle } = formatThreadTitle(rawTitle);
              const isActive = threadId === thread.thread_id;
              
              // Nếu title đã được rút gọn, hiển thị tooltip
              const needsTooltip = displayTitle !== fullTitle;
              
              const linkElement = (
                <a
                  href="#"
                  className={cn(
                    "block rounded px-3 py-2 text-sm truncate transition font-medium",
                    isActive
                      ? "bg-primary/80 text-primary-foreground"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    setThreadId(thread.thread_id);
                  }}
                  title={needsTooltip ? fullTitle : undefined} // Fallback title attribute
                >
                  {displayTitle}
                </a>
              );

              return (
                <li key={thread.thread_id}>
                  {needsTooltip ? (
                    <TooltipProvider delayDuration={500}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {linkElement}
                        </TooltipTrigger>
                        <TooltipContent 
                          side="right" 
                          className="max-w-xs z-50"
                          sideOffset={8}
                        >
                          <p className="break-words text-sm">{fullTitle}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    linkElement
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
}