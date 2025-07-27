import React from "react";
import { UserCircle2, Bell, Mail } from "lucide-react";

export function RightSidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground w-64 min-h-screen p-6 border-l border-sidebar-border flex flex-col gap-6">
      {/* User info */}
      <div className="flex items-center gap-3">
        <UserCircle2 className="size-10 text-primary" />
        <div>
          <div className="font-semibold">Your Name</div>
          <div className="text-xs text-muted-foreground">Admin</div>
        </div>
      </div>
      {/* Notifications */}
      <div>
        <div className="font-bold mb-2 text-sm">Notifications</div>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-muted-foreground">
            <Bell className="size-4" /> New message from John
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" /> Server status: All good
          </li>
        </ul>
      </div>
      {/* Thêm các box/info khác nếu muốn */}
    </aside>
  );
}
