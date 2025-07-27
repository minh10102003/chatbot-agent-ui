"use client";

import React, { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner"; // hoặc 'sonner' tuỳ bạn export

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <Toaster />
      {children}
    </>
  );
}