"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";

import { getSocket } from "@/lib/socket-client";

export const useSocket = () => {
  const [socket] = useState<Socket | null>(() => (typeof window === "undefined" ? null : getSocket()));

  return socket;
};
