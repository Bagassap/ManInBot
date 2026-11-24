"use client";

import { createContext } from "react";

export const DesktopSlot = createContext<HTMLElement | null>(null);

export const NEW_CHAT_EVENT = "mib-new-chat";
