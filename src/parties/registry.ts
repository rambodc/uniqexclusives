import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { PartyPageProps } from "./types";

type PartyPage = LazyExoticComponent<ComponentType<PartyPageProps>>;
/** Wraps a page import so its code and art only load for its own guests. */
export function definePage(load: () => Promise<{ default: ComponentType<PartyPageProps> }>): PartyPage { return lazy(load); }

/**
 * Custom party pages, one folder each: src/parties/<slug>/Page.tsx (default export, takes PartyPageProps).
 * A party shows its page when its `pageSlug` (picked in the party's edit form) matches a key here. See src/parties/README.md.
 *   "uex-2": definePage(() => import("./uex-2/Page")),
 */
export const PARTY_PAGES: Record<string, PartyPage> = {
};
export const PAGE_SLUGS = Object.keys(PARTY_PAGES);
export function hasPage(slug: string | null): slug is string { return !!slug && Object.hasOwn(PARTY_PAGES, slug); }
