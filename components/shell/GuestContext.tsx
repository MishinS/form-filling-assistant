"use client";
import { createContext } from "react";

/** True only inside the guest shell. DoneStep uses it to skip history persistence. */
export const GuestContext = createContext<{ guest: boolean }>({ guest: false });
