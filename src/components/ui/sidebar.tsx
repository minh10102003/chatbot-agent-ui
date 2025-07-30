// src/providers/Sidebar.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquarePlus as NewChatIcon,
  Search,
  Book as LibraryIcon,
  UserCircle2 as AvatarIcon,
  MoreHorizontal as MoreIcon,
  Edit2 as EditIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useThreads } from "@/providers/Thread";
import { useQueryState } from "nuqs";
import { getApiKey } from "@/lib/api-key";
import { createClient } from "@/providers/client";
import { getThreadDisplayTitle } from "@/lib/thread-utils";

const LogoIcon = AvatarIcon;

export function Sidebar({ className }: { className?: string }) {
  const {
    threads,
    threadsLoading,
    getThreads,
    setThreads,
    setThreadsLoading,
  } = useThreads();
  const [threadId, setThreadId] = useQueryState("threadId");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://agent.grozone.vn";

  // track which thread's menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // for rename dialog
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // for delete dialog
  const [deletingThread, setDeletingThread] = useState<string | null>(null);

  // wrapper ref to detect outside clicks
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(() => setThreads([]))
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  // close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick(e: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuId]);

  const handleNewThread = async () => {
    if (!apiUrl) return;
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      const newThread = await client.threads.create({
        metadata: { title: "New Chat" },
      });
      setThreadId(newThread.thread_id);
      setThreads((prev) => [newThread, ...prev]);
    } catch {
      alert("Không thể tạo đoạn chat mới!");
    }
  };

  const HISTORY_MAX_HEIGHT = 600;

  return (
    <aside
      className={cn(
        "flex flex-col min-h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        className
      )}
      style={{ minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <LogoIcon className="size-7 text-primary" />
          <span className="font-semibold text-lg">Quantica</span>
        </div>
        <button
          onClick={handleNewThread}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          aria-label="Đoạn chat mới"
        >
          <NewChatIcon className="size-5" />
        </button>
      </div>

      {/* Main Menu */}
      <nav className="px-3 py-4 flex flex-col gap-1 border-b border-sidebar-border">
        <SidebarMenuItem
          icon={<NewChatIcon className="size-4" />}
          label="Đoạn chat mới"
          onClick={handleNewThread}
        />
        <SidebarMenuItem icon={<Search className="size-4" />} label="Tìm kiếm" />
        <SidebarMenuItem
          icon={<LibraryIcon className="size-4" />}
          label="Thư viện"
        />
      </nav>

      {/* Chat History */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
            Đoạn chat
          </h3>
        </div>
        <div
          ref={menuContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4"
          style={{ maxHeight: HISTORY_MAX_HEIGHT }}
        >
          {threadsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-10 bg-sidebar-accent rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="text-xs text-muted-foreground px-3 py-4 text-center">
              Chưa có cuộc trò chuyện
            </div>
          ) : (
            <div className="space-y-1">
              {threads.slice(0, 20).map((thread) => {
                const title = getThreadDisplayTitle(thread);
                const isActive = threadId === thread.thread_id;

                return (
                  <div
                    key={thread.thread_id}
                    className="relative flex items-center"
                  >
                    {/* Select Thread */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setThreadId(thread.thread_id);
                        setOpenMenuId(null);
                      }}
                      className={cn(
                        "w-full h-12 flex items-center px-3 rounded-lg text-sm transition-all duration-200 overflow-hidden",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                      )}
                    >
                      <div className="truncate font-medium">{title}</div>
                    </button>

                    {/* “…” Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId((prev) =>
                          prev === thread.thread_id
                            ? null
                            : thread.thread_id
                        );
                      }}
                      className="p-2 hover:bg-sidebar-accent rounded-full ml-1"
                    >
                      <MoreIcon className="size-4 text-sidebar-foreground" />
                    </button>

                    {/* Menu Options */}
                    {openMenuId === thread.thread_id && (
                      <div
                        className="absolute top-12 right-0 w-32 bg-background border border-sidebar-border rounded shadow-md z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setNewName(title);
                            setEditingThread(thread.thread_id);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-sidebar-accent text-sm"
                        >
                          <EditIcon className="size-4" /> Đổi tên
                        </button>
                        <button
                          onClick={() => {
                            setDeletingThread(thread.thread_id);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-red-600 hover:text-white text-sm"
                        >
                          <TrashIcon className="size-4" /> Xóa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog.Root
        open={editingThread !== null}
        onOpenChange={(open) => {
          if (!open) setEditingThread(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Đổi tên cuộc trò chuyện
            </Dialog.Title>
            <input
              type="text"
              className="w-full mb-4 px-3 py-2 border rounded bg-input text-foreground"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nhập tên mới..."
            />
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2">Hủy</button>
              </Dialog.Close>
              <button
                className="px-4 py-2 bg-primary text-white rounded"
                onClick={async () => {
                  if (!editingThread || !newName.trim()) return;
                  try {
                    const client = createClient(
                      apiUrl!,
                      getApiKey() ?? undefined
                    );
                    await client.threads.update(editingThread, {
                      metadata: { title: newName.trim() },
                    });
                    setThreads((prev) =>
                      prev.map((t) =>
                        t.thread_id === editingThread
                          ? {
                              ...t,
                              metadata: {
                                ...t.metadata,
                                title: newName.trim(),
                              },
                            }
                          : t
                      )
                    );
                  } catch {
                    alert("Đổi tên thất bại");
                  } finally {
                    setEditingThread(null);
                  }
                }}
              >
                Lưu
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Dialog */}
      <Dialog.Root
        open={deletingThread !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingThread(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Xác nhận xóa
            </Dialog.Title>
            <p className="mb-6">
              Bạn có chắc muốn xóa cuộc trò chuyện này không?
            </p>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2">Hủy</button>
              </Dialog.Close>
              <button
                className="px-4 py-2 bg-destructive text-white rounded"
                onClick={async () => {
                  if (!deletingThread) return;
                  try {
                    const client = createClient(
                      apiUrl!,
                      getApiKey() ?? undefined
                    );
                    await client.threads.delete(deletingThread);
                    setThreads((prev) =>
                      prev.filter((t) => t.thread_id !== deletingThread)
                    );
                    if (threadId === deletingThread) {
                      setThreadId(null);
                    }
                  } catch {
                    alert("Xóa thất bại");
                  } finally {
                    setDeletingThread(null);
                  }
                }}
              >
                Xóa
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  );
}

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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition font-medium text-sm select-none cursor-pointer",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
