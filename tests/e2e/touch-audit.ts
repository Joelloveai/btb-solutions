import type { Page } from "@playwright/test";

export type TouchProblem = { what: string; problem: string };

/**
 * Every interactive element that is on screen must be at least 48px tall, and no two may sit closer than
 * 8px to each other. A checkbox or radio is measured by the label around it (that is what a thumb hits).
 * Elements that only appear for screen readers (sr-only file inputs) and the floating + button's overlap
 * with the page behind it are not counted.
 */
export async function auditTouchTargets(page: Page, { ignore = [] as string[] } = {}): Promise<TouchProblem[]> {
  return page.evaluate((ignoreSelectors) => {
    const MIN_H = 47.5;
    const MIN_GAP = 7.5;
    const selector = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], [role=link]';
    const name = (el: Element) => {
      const text = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("name") || el.getAttribute("placeholder") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()} "${text}"`;
    };
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) return false;
      if (el.closest("[aria-hidden=true]")) return false;
      if (ignoreSelectors.some((sel) => el.matches(sel) || el.closest(sel))) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const target = (el: Element) => {
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) return el.closest("label") ?? el;
      return el;
    };
    const nodes = Array.from(new Set(Array.from(document.querySelectorAll(selector)).filter(visible).map(target)));
    const boxes = nodes.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const problems: { what: string; problem: string }[] = [];
    for (const { el, r } of boxes) {
      if (r.height < MIN_H) problems.push({ what: name(el), problem: `only ${Math.round(r.height)}px tall` });
    }
    // Things pinned to the screen (the + button, the bottom bar) float over scrolling content: that is layering, not crowding.
    const pinned = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
      return false;
    };
    const isFab = (el: Element) => el.getAttribute("aria-label") === "Add to timeline";
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (isFab(a.el) || isFab(b.el)) continue;
        if (pinned(a.el) !== pinned(b.el)) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const overlapX = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const overlapY = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (overlapX > 1 && overlapY > 1) continue; // overlapping layers (an input and its icon button), not neighbours
        const gapY = overlapX > 1 ? Math.max(a.r.top, b.r.top) - Math.min(a.r.bottom, b.r.bottom) : Infinity;
        const gapX = overlapY > 1 ? Math.max(a.r.left, b.r.left) - Math.min(a.r.right, b.r.right) : Infinity;
        const gap = Math.min(gapX, gapY);
        if (gap < MIN_GAP) problems.push({ what: `${name(a.el)} and ${name(b.el)}`, problem: `only ${Math.round(gap)}px apart` });
      }
    }
    return problems;
  }, ignore);
}
