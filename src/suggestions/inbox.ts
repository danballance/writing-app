import { useCallback, useEffect, useMemo, useReducer } from "react";

import type {
  AgentStatus,
  SuggestionEvent,
  SuggestionFeed,
  SuggestionItem,
} from "./types";

export type InboxEntry = {
  item: SuggestionItem;
  viewed: boolean;
  stale: boolean;
  withdrawn: boolean;
};

type InboxState = {
  entries: InboxEntry[];
  seenKeys: Record<string, true>;
  selectedId?: string;
  activePreviewId?: string;
  status: AgentStatus;
  error?: { message: string; recoverable: boolean };
};

type InboxAction =
  | { type: "event"; event: SuggestionEvent }
  | { type: "select"; id: string }
  | { type: "back" }
  | { type: "dismiss"; id: string }
  | { type: "preview.started"; id: string }
  | { type: "preview.resolved"; id: string; outcome: "accepted" | "cancelled" };

export const initialInboxState: InboxState = {
  entries: [],
  seenKeys: {},
  status: "idle",
};

function enforceLimit(state: InboxState): InboxState {
  if (state.entries.length <= 30) {
    return state;
  }

  const protectedIds = new Set(
    [state.selectedId, state.activePreviewId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const evictionOrder = [...state.entries]
    .filter((entry) => !protectedIds.has(entry.item.id))
    .sort((a, b) => {
      if (a.viewed !== b.viewed) {
        return a.viewed ? -1 : 1;
      }
      return a.item.createdAt - b.item.createdAt;
    });
  const removeCount = state.entries.length - 30;
  const evicted = new Set(
    evictionOrder.slice(0, removeCount).map((entry) => entry.item.id),
  );

  return {
    ...state,
    entries: state.entries.filter((entry) => !evicted.has(entry.item.id)),
  };
}

export function inboxReducer(
  state: InboxState,
  action: InboxAction,
): InboxState {
  if (action.type === "event") {
    const event = action.event;

    if (event.type === "agent.status") {
      return { ...state, status: event.status, error: undefined };
    }

    if (event.type === "agent.error") {
      return {
        ...state,
        status: "idle",
        error: { message: event.message, recoverable: event.recoverable },
      };
    }

    if (event.type === "suggestion.added") {
      if (state.seenKeys[event.item.dedupeKey]) {
        return state;
      }

      return enforceLimit({
        ...state,
        entries: [
          ...state.entries,
          { item: event.item, viewed: false, stale: false, withdrawn: false },
        ],
        seenKeys: { ...state.seenKeys, [event.item.dedupeKey]: true },
      });
    }

    if (event.type === "suggestion.updated") {
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.item.id === event.item.id
            ? {
                ...entry,
                item: event.item,
                stale: entry.item.id === state.activePreviewId,
              }
            : entry,
        ),
      };
    }

    const protectedItem =
      event.id === state.selectedId || event.id === state.activePreviewId;
    return {
      ...state,
      entries: protectedItem
        ? state.entries.map((entry) =>
            entry.item.id === event.id
              ? { ...entry, withdrawn: true, stale: true }
              : entry,
          )
        : state.entries.filter((entry) => entry.item.id !== event.id),
    };
  }

  if (action.type === "select") {
    return {
      ...state,
      selectedId: action.id,
      entries: state.entries.map((entry) =>
        entry.item.id === action.id ? { ...entry, viewed: true } : entry,
      ),
    };
  }

  if (action.type === "back") {
    return {
      ...state,
      selectedId: undefined,
      entries: state.entries.filter(
        (entry) =>
          !entry.withdrawn || entry.item.id === state.activePreviewId,
      ),
    };
  }

  if (action.type === "dismiss") {
    return {
      ...state,
      selectedId: state.selectedId === action.id ? undefined : state.selectedId,
      entries: state.entries.filter((entry) => entry.item.id !== action.id),
    };
  }

  if (action.type === "preview.started") {
    return {
      ...state,
      activePreviewId: action.id,
      entries: state.entries.map((entry) =>
        entry.item.id === action.id ? { ...entry, viewed: true } : entry,
      ),
    };
  }

  const resolvedEntry = state.entries.find(
    (entry) => entry.item.id === action.id,
  );
  const shouldRemove =
    action.outcome === "accepted" || resolvedEntry?.withdrawn === true;
  return {
    ...state,
    activePreviewId: undefined,
    selectedId: shouldRemove ? undefined : state.selectedId,
    entries: shouldRemove
      ? state.entries.filter((entry) => entry.item.id !== action.id)
      : state.entries,
  };
}

export function useSuggestionInbox(feed: SuggestionFeed) {
  const [state, dispatch] = useReducer(inboxReducer, initialInboxState);

  useEffect(
    () => feed.subscribe((event) => dispatch({ type: "event", event })),
    [feed],
  );

  const entries = useMemo(
    () =>
      [...state.entries].sort((a, b) => {
        if (a.viewed !== b.viewed) {
          return a.viewed ? 1 : -1;
        }
        return b.item.createdAt - a.item.createdAt;
      }),
    [state.entries],
  );
  const selectedEntry = state.selectedId
    ? state.entries.find((entry) => entry.item.id === state.selectedId)
    : undefined;
  const select = useCallback((id: string) => dispatch({ type: "select", id }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const dismiss = useCallback(
    (id: string) => dispatch({ type: "dismiss", id }),
    [],
  );
  const previewStarted = useCallback(
    (id: string) => dispatch({ type: "preview.started", id }),
    [],
  );
  const previewResolved = useCallback(
    (id: string, outcome: "accepted" | "cancelled") =>
      dispatch({ type: "preview.resolved", id, outcome }),
    [],
  );

  return {
    ...state,
    entries,
    selectedEntry,
    unreadCount: state.entries.filter((entry) => !entry.viewed).length,
    select,
    back,
    dismiss,
    previewStarted,
    previewResolved,
  };
}
