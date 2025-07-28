import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getThreadDisplayTitle } from "@/utils/thread-utils";

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-1 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((thread) => {
        const displayTitle = getThreadDisplayTitle(thread);
        const isActive = threadId === thread.thread_id;
        
        return (
          <div key={thread.thread_id} className="w-full px-1">
            <Button
              variant="ghost"
              className={`w-full h-auto min-h-[40px] items-start justify-start text-left font-normal p-3 rounded-lg transition-colors ${
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "hover:bg-gray-100"
              }`}
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(thread.thread_id);
                if (thread.thread_id === threadId) return;
                setThreadId(thread.thread_id);
              }}
            >
              <div className="w-full text-left">
                <p className="text-sm font-medium truncate text-ellipsis leading-tight">
                  {displayTitle}
                </p>
                {/* Hiển thị thời gian nếu có */}
                {thread.created_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(thread.created_at).toLocaleDateString('vi-VN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll px-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="w-full">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, []);

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[280px] shrink-0 flex-col items-start justify-start gap-4 border-r-[1px] border-slate-200 bg-gray-50/50 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-semibold tracking-tight text-gray-800">
            Chat History
          </h1>
          <Button
            className="hover:bg-gray-200 h-8 w-8 p-0"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
            title={chatHistoryOpen ? "Đóng lịch sử" : "Mở lịch sử"}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )}
          </Button>
        </div>
        
        <div className="flex-1 w-full px-2 pb-4">
          {threadsLoading ? (
            <ThreadHistoryLoading />
          ) : threads.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
            </div>
          ) : (
            <ThreadList threads={threads} />
          )}
        </div>
      </div>

      {/* Mobile sheet */}
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent side="left" className="flex flex-col lg:hidden w-[280px]">
            <SheetHeader className="pb-4">
              <SheetTitle>Chat History</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              {threadsLoading ? (
                <ThreadHistoryLoading />
              ) : (
                <ThreadList
                  threads={threads}
                  onThreadClick={() => setChatHistoryOpen(false)}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}