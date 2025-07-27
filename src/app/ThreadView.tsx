'use client';

import React from "react";
import { useSearchParams } from "next/navigation";
import { Thread } from "@/components/thread";

export default function ThreadView() {
  const params = useSearchParams();
  return <Thread />;
}