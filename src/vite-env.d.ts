/// <reference types="vite/client" />

import type {
  DesktopBridge,
  DesktopDevelopmentBridge,
} from "./shared/desktop";

declare global {
  interface Window {
    scribe?: DesktopBridge;
    scribeDevelopment?: DesktopDevelopmentBridge;
  }
}

export {};
