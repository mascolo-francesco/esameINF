import { createCn } from "cn/config";

/**
 * Unione delle classi Tailwind. I gradini di testo del tema (text-step-*) vanno dichiarati come dimensioni:
 * altrimenti vengono presi per colori e cancellano text-primary-foreground e simili.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["step-small", "step-body", "step-lead", "step-head", "step-display"] }] } },
});
