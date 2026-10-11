---
name: apple-design
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), forms and focus management, keyboard interaction, loading/empty/error states, data tables and lists, iconography and microcopy, reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.
---

# Apple Design

## Initial Response

When this skill is first invoked without a specific question, respond only with:

> I'm ready to help you build fluid, Apple-style interfaces on the web, my knowledge comes from Apple's WWDC design talks, translated for the web.

Do not provide any other information until the user asks a question.

How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. This knowledge comes from Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — distilled and translated into the web platform (CSS, Pointer Events, `requestAnimationFrame`, spring libraries like Motion/Framer Motion).

The through-line: **an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.** Springs are the tool that makes all of this natural, because they are inherently interruptible and velocity-aware.

## The Core Idea

> "When we align the interface to the way we think and move, something magical happens — it stops feeling like a computer and starts feeling like a seamless extension of us."

An interface is fluid when it behaves like the physical world: things respond instantly, move continuously, carry momentum, resist at boundaries, and can be redirected mid-motion. Everything below is a way to get closer to that.

Apple frames design as serving four human needs: **safety/predictability, understanding, achievement, and joy.** Every rule here serves one of them.

## Scope — read this before applying anything

This skill is strongest for **touch and pointer-driven surfaces**: sheets, drawers, carousels, cards, canvases, media controls, anything the user physically grabs. Applied wholesale to a different kind of product it will actively mislead.

**Apply fully to:** mobile web, tablet, touch-first apps, anything with drag/swipe/pinch, media and creative tools, marketing surfaces where feel is the product.

**Apply selectively to:** dense desktop software — admin panels, dashboards, back-offices, data tools. Sections 1 (response), 3 (interruptibility), 7 (spatial consistency), 11–21 all apply. Sections 2, 5, 6, 9, 10 (direct manipulation, velocity handoff, momentum projection, rubber-banding, gesture recognizers) mostly do not: **do not add drag gestures to a keyboard-driven tool because this document is loaded.** A table row that can be flung is worse than one that cannot.

**Barely applies to:** kiosks, single-purpose terminals, screens read at distance. There, size, contrast and latency are the whole design; motion is decoration and often a liability.

Ask which of these you are building before reaching for springs.

### Pairing with a visual-system skill

This skill covers **how an interface behaves**: response, motion, interaction, structure. It deliberately does not define a palette, brand tokens, or spacing scale — those belong in a project's own design-system skill or token file.

When a project has one, that file wins on every concrete value: colors, radii, type scale, spacing, density. This skill supplies behavior and craft. If the two disagree about a specific number, the project's system is right. Never hardcode a brand colour from here into a component.

## 1. Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff." Response is the foundation everything else is built on.

- **Respond on pointer-down, not on release.** Highlight a button the instant it's pressed. Waiting for `click`/touch-up to show feedback feels dead.
- **Be vigilant about every latency.** Audit debounces, artificial timers, transition waits, and the ~300ms tap delay. Anything on the input path that isn't essential is a regression.
- **Feedback must be continuous *during* the interaction, not just at the end.** For a drag, slider, or drawer, update the UI 1:1 with the pointer the whole way through — never animate only when the gesture completes.
- **Budget: visible acknowledgement within ~100ms**, always. If the real work takes longer, acknowledge first and resolve later (§17). A spinner shown at 400ms is a failure of the first 400ms, not a solution.

```css
/* Feedback lives on the press, and it's instant */
.button:active {
  transform: scale(0.97);
  transition: transform 100ms ease-out;
}
```

## 2. Direct manipulation — 1:1 tracking

> "Touch and content should move together."

When the user drags something, it must stay glued to the finger — and respect the offset from *where they grabbed it*. Snapping to the element's center on grab breaks the illusion immediately.

- Use Pointer Events with `setPointerCapture` so tracking continues even when the pointer leaves the element's bounds.
- Track a short **velocity/position history** (last few `pointermove` events), not just the current point — you'll need velocity at release.
- Set `touch-action` to tell the browser which axis you own (`pan-y`, `none`), or the browser's own scrolling will fight your gesture.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top; // respect where they grabbed
  // ...track position + timestamp history for velocity
});
```

## 3. Interruptibility — the single most important principle

> "The thought and the gesture happen in parallel."

Every animation must be interruptible and redirectable at any moment. A user must be able to grab a moving element mid-flight and reverse it without waiting for the animation to finish. A closing modal the user grabs again should follow the finger — not finish closing first, then reopen.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target value.** On interrupt, read the element's live on-screen transform and start the new animation from there. Starting from the logical/target value causes a visible jump.
- **Avoid CSS transitions and `@keyframes` for anything gesture-driven** — they can't be smoothly grabbed and reversed mid-flight. Springs animate from the current value by default, which is exactly what interruption needs.
- **When a gesture reverses, blend velocity — don't hard-cut it.** Replacing one animation with another at a reversal creates a velocity discontinuity, a "brick wall." Spring libraries that carry velocity through a re-target avoid it. (This is what iOS's *additive animations* do natively; on the web, choose a spring library that re-targets from the current velocity.)
- **Decompose 2D motion into independent X and Y springs.** A single spring on a 2D distance desyncs when X and Y have different velocities.

## 4. Behavior over animation — use springs

> "Think of animation as a conversation between you and the object, not something prescribed by the interface."

A pre-scripted, fixed-duration animation can't respond to new input. A spring can — new input just changes the target, and the motion stays continuous. Reach for springs for anything a user can touch.

Apple deliberately replaced the physics triplet (mass/stiffness/damping) with two designer-friendly parameters. Think in these:

- **Damping ratio** — controls overshoot. `1.0` = critically damped, no bounce, smooth settle. `< 1.0` = overshoots and oscillates. Lower = bouncier.
- **Response** — how quickly the value reaches the target, in seconds. Lower = snappier. **This is not "duration"** — a spring has no fixed duration; its settle time emerges from the parameters.

**Defaults:**
- Start most UI at **damping `1.0`** (critically damped) — graceful and non-distracting.
- Add bounce (**damping ~`0.8`**) **only when the gesture itself carried momentum** (a flick, a throw, a drag release). Overshoot on a menu that just faded in feels wrong; overshoot on a card you flicked feels right.

**Concrete values Apple ships:**

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition (e.g. PiP) | `1.0` | `0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

**Web mapping (Motion / Framer Motion):** the `bounce` + `duration` spring API maps closely to Apple's damping + response. A safe house style is `damping: 1.0` springs everywhere by default; reserve bounce for momentum-driven, physical interactions.

```js
import { animate } from 'motion';

// Critically damped default (no overshoot)
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });

// Momentum interaction — a little bounce, only because a flick preceded it
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 });
```

**Without a JS library:** CSS `linear()` can approximate a spring curve for *non-interruptible*, non-gestural motion (an entrance, a state change). It is a sampled curve, not a simulation — it cannot absorb velocity or be grabbed mid-flight. Use it for polish on things the user can't touch; use a real spring for anything they can.

```css
/* a sampled spring-ish curve; fine for entrances, wrong for drags */
.toast { transition: transform 420ms linear(0, 0.42, 0.84, 1.01, 1.02, 1); }
```

## 5. Velocity handoff — the seam between drag and animation

When a gesture ends, the animation must **continue at the finger's exact velocity**, so there's no visible seam between dragging and animating. This is the detail that most separates "fluid" from "fine."

Pass the pointer's release velocity as the spring's initial velocity. Some spring APIs want **relative** velocity — normalize it by the remaining distance to the target:

```
relativeVelocity = gestureVelocity / (targetValue − currentValue)
```

Example: element at `y=50`, target `y=150` (100px to go), finger moving 50px/s → initial spring velocity = `50 / 100 = 0.5`. Framer Motion / Motion take absolute px/s velocity directly (`velocity` option), so you usually hand it the raw value.

## 6. Momentum projection — animate to where the gesture is *going*

> "Take a small input and make a big output."

Don't snap to the nearest boundary from the *release point*. Use velocity to **project the resting position** — exactly like scroll deceleration — then snap to the target nearest that projected point. This is what makes a flick feel like it throws the element.

Apple's exact projection function (from the *Designing Fluid Interfaces* sample code):

```js
// decelerationRate ≈ 0.998 for normal scroll feel; 0.99 for snappier
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);   // choose target from the projection
animateSpringTo(target, { velocity: releaseVelocity }); // then hand off velocity (§5)
```

Note: the physics-textbook `v²/(2·decel)` is *not* what Apple ships — use the exponential-decay form above. This is the standard behavior in good bottom-sheets and carousels (Vaul, Embla).

## 7. Spatial consistency — symmetric paths, anchored origins

> "If something disappears one way, we expect it to emerge from where it came."

- **Enter and exit along the same path.** A panel that slides in from the right must dismiss to the right. In-from-right / out-the-bottom feels disconnected and confusing.
- **Anchor interactions to their source.** A menu, popover, or sheet should originate from the element that triggered it — set `transform-origin` to the trigger, so the spatial relationship between button and content is obvious. (This is the same origin-awareness point as popovers scaling from their trigger, not their center.)
- **Mirror the easing on reversible transitions** so the outbound path matches the return path (use inverse cubic-bézier control points for the two directions).
- **Keep a persistent element persistent.** When the same object exists on both sides of a navigation, move it rather than cross-fading two copies. The View Transitions API does this declaratively where supported; a shared-layout animation does it in JS. Progressive enhancement — the un-supported path should still be a clean cut, never a broken frame.

## 8. Hint in the direction of the gesture

Humans predict a final state from a trajectory. Intermediate motion should telegraph where things are going — Control Center modules "grow up and out toward your finger." Make the in-between frames point at the outcome, not just interpolate blindly to it.

## 9. Rubber-banding — soft boundaries

At an edge, resist progressively instead of stopping hard. A hard stop reads as "frozen"; continuous resistance reads as "responsive, but there's nothing more here." Apply damping that increases the further past the boundary the user drags.

```js
// The further past the bound, the less the element follows — real things slow before they stop
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details (the "feel" checklist)

- **Tap:** highlight on touch-*down* (instant), commit on touch-*up*. Add ~10px of hysteresis/hit padding around the target, and allow cancel-by-dragging-away and back.
- **Drag/swipe:** require a small movement threshold (hysteresis, ~10px) before committing to a direction, then track 1:1.
- **Detect all plausible gestures in parallel from the first move**, then confidently cancel the losers once intent is clear. Avoid recognizers that only report a *final* state (`swipeleft`-type events) — they throw away the continuous tracking you need for feedback.
- **Minimize disambiguation delays.** Double-tap detection unavoidably delays single taps; only pay that cost where double-tap truly exists.
- **Every gesture needs a non-gesture equivalent.** A swipe-to-delete row must also have a visible delete control; a drag-to-reorder list needs keyboard reordering. A gesture is an accelerator, never the only door.

## 11. Frame-level smoothness

Smoothness is about *what's in the frames*, not just the frame rate.

- Keep the per-frame positional change below the perception threshold to avoid strobing.
- For very fast motion, a subtle **motion blur / stretch** encodes speed and reads better than a hard sharp streak.
- `requestAnimationFrame` is the web's display-synced clock (Apple uses `CADisplayLink`). Animate only compositor-friendly properties — `transform` and `opacity` — and hint with `will-change` where motion is imminent.
- **Never animate layout properties** (`width`, `height`, `top`, `margin`) — they force layout on every frame. Animate a transform and correct the geometry at the end, or use a FLIP technique.
- **Remove `will-change` once the motion ends.** Left on permanently it holds a compositor layer per element and makes everything slower.
- **Read then write.** Batch all measurement (`getBoundingClientRect`) before any style mutation in a frame; alternating them thrashes layout.

## 12. Materials & depth — translucency conveys hierarchy

Apple uses translucent materials as a floating functional layer that brings structure without stealing focus. On the web, approximate with `backdrop-filter`.

- **Build nav/toolbars/sheets as translucent layers** (`backdrop-filter: blur()` + a semi-transparent background) with content scrolling underneath — not opaque bars that consume a fixed strip.
- **Material weight encodes hierarchy:** darker/heavier materials separate structural regions (sidebars); lighter materials draw attention to interactive elements (buttons). **Never stack a light translucent surface on another** — legibility collapses.
- **Bigger surfaces should read as thicker:** stronger blur + a deeper shadow than small chips. Consider context-aware shadow — heavier over busy/text content for separation, lighter over plain backgrounds.
- **Dim to focus, separate to keep flow.** A modal task pairs the surface with a dimming scrim and pushes the background back/down. A parallel, non-blocking panel uses translucency and offset *without* a scrim so the flow isn't broken. For stacked sheets, progressively dim and push back each parent layer.
- **Vibrancy keeps text legible over changing backgrounds.** Over blurred/translucent surfaces, don't use flat gray text — use higher-contrast, slightly heavier weight, and a small letter-spacing bump. Put color on a solid layer, not the translucent foreground.
- **Scroll edge effects, not hard dividers.** Instead of a 1px border under a sticky header, fade a small blur/gradient mask where content meets floating chrome — only where floating UI actually overlaps content.
- **Materialize, don't just fade.** For glass/blur surfaces, animate blur radius and scale together on enter/exit, so the surface reads as a real material arriving rather than a plain opacity fade.
- **`backdrop-filter` is expensive.** Budget a handful of translucent surfaces per screen, never one per list row, and never animate a large blurred surface's size.

```css
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.4); /* bright top edge = light catching the material */
}
```

## 13. Multimodal feedback — motion + sound + haptics

Three rules for combining senses (from *Designing Audio-Haptic Experiences*):

1. **Causality** — it must be obvious what caused the feedback. Trigger it on the actual causal event (the toggle flipping, the item snapping home), and match its character to the action's physicality.
2. **Harmony** — the visual, the sound, and the haptic must fire on the **same frame**. Latency between them destroys the illusion. Don't let a CSS transition lag the audio/haptic (Vibration API).
3. **Utility** — add feedback only where it earns its place. Reserve haptics/sound for meaningful moments (success, error, commit, snap). Over-feedback trains users to ignore all of it.

Web caveats: the Vibration API is unsupported on iOS Safari and absent on desktop, and audio needs a prior user gesture to play. Treat both as enhancement — never the only channel carrying meaning.

## 14. Reduced motion & accessibility

Reduced motion doesn't mean *no* feedback — it means a gentler, non-vestibular equivalent. Respond to three independent signals and bake them into your components:

- **`prefers-reduced-motion: reduce`** — replace slides/springs/parallax with short opacity **cross-fades or static transitions**. Drop elastic/overshoot. Keep opacity/color changes that aid comprehension.
- **`prefers-reduced-transparency: reduce`** — make translucent surfaces frostier/solid: raise background opacity, drop the blur.
- **`prefers-contrast: more`** — near-solid backgrounds with a defined, contrasting border.

Also: avoid full-viewport moving backgrounds, slow looping oscillations (near 0.2 Hz / one cycle per 5s), and abrupt brightness jumps (ease dark↔light theme changes). Make large moving objects semi-transparent while they travel, and fade big surfaces out during a large reposition and back in once settled.

Beyond motion, non-negotiable baselines:

- **Colour is never the only carrier of meaning.** Pair it with text, an icon, or a shape. Roughly 1 in 12 men cannot separate your red from your green.
- **Contrast:** 4.5:1 body text, 3:1 large text and meaningful UI boundaries. Verify the actual computed ratio; do not eyeball it.
- **Everything interactive is reachable and operable by keyboard**, in the order it appears visually.
- **Respect the user's text size.** Layout in `rem`/`em` so a 200% setting reflows rather than clips.
- **Announce what changed.** Dynamic results, toasts and validation summaries need a live region, or a screen-reader user never learns the thing happened.

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; }
}
```

## 15. Typography — optical sizing, tracking, leading

Apple designs type to change shape with size; the same discipline applies on the web. (From *The Details of UI Typography*, WWDC 2020.)

- **Tracking (letter-spacing) is size-specific — never one value for all sizes.** Large display text wants *negative* tracking (letters read too far apart as they grow); small text wants slightly *positive* tracking for legibility. A fixed `letter-spacing` is wrong somewhere. Tighten headings, leave body near `0`.
- **Leading (line-height) tracks size inversely.** Tight on large headings, looser on body copy. Increase it for scripts with tall ascenders/descenders; tighten it for dense, information-heavy UI.
- **Build hierarchy from weight + size + leading as a set,** not size alone. Emphasize with weight — it adds presence without taking more space.
- **Respect the user's text-size setting** (Dynamic Type). Scale layout *with* the text — spacing in `rem`/`em`, not fixed px — so a larger font doesn't break the layout.
- **Default to the platform's system font** before a custom face; it already ships optical sizing, tracking tables, and legibility tuning. Override only with a reason.
- **Cap measure at 60–75 characters** for prose. Wider and the eye loses the line return.
- **Use real numerals for the job:** `tabular-nums` wherever figures stack in a column or tick in place; proportional elsewhere.

```css
:root { font: 100%/1.5 system-ui, sans-serif; } /* body: system font, comfortable leading */

.display {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;        /* tight leading for large text */
  letter-spacing: -0.02em;  /* negative tracking as it grows */
  font-optical-sizing: auto;
}
```

## 16. Forms, focus and the keyboard

Forms are where craft is most visible and most often skipped. The through-line is the same as §1: respond immediately, and never make the user guess.

**Validation timing — the single biggest lever.**
- **Never validate on keystroke.** Telling someone their email is invalid while they're typing the third character is hostile.
- **Validate a field on blur**, once they've had a chance to finish.
- **Once a field is already in error, re-validate on input** so the error clears the instant it's fixed. Errors should disappear eagerly and appear reluctantly.
- **Never disable the submit button to express invalidity.** A disabled button gives no reason and no focus target. Let them submit, then move focus to the first error and announce the count.

**Errors.**
- Place the message adjacent to the field, bound with `aria-describedby`, not in a distant summary alone.
- Say what is wrong **and what to do**: "The CI must be 4–12 digits", not "Invalid input".
- Never destroy what the user typed. Preserve the value and let them fix it.

**Focus.**
- Use `:focus-visible`, not `:focus` — pointer users shouldn't see rings, keyboard users must.
- **Never remove the focus indicator without replacing it** with something at least as visible (3:1 against the adjacent surface).
- DOM order is tab order. If the visual order and DOM order disagree, fix the DOM — don't paper over it with `tabindex` numbers above 0, which create a separate, surprising tab sequence.
- On route change, move focus to the new view's heading. Otherwise a keyboard user is still focused on a link that no longer exists.
- In a modal, trap focus, focus the first meaningful element (not the close button), and return focus to the trigger on dismiss. `<dialog>` gives most of this for free.

**Input mechanics.**
- Every input has a real `<label>`. Placeholders are not labels: they vanish exactly when needed and usually fail contrast.
- Set `autocomplete` and `inputmode` honestly — `inputmode="numeric"` on a document number saves a keyboard switch on every mobile entry.
- Enter submits a single-logical-form; `Cmd/Ctrl+Enter` submits from a textarea.
- Escape closes the topmost layer only, in order: menu, then dialog, then page.
- Format on blur, not while typing. Reformatting under the cursor moves it and loses the user's place.
- Touch targets ≥ 44px; mouse-only UI can go to 28–32px but no smaller.

**Shortcuts.** Only add them for actions used many times per session, show them in the UI next to the action, and never override a browser shortcut the user depends on.

## 17. States: loading, empty, error, success

Most interfaces are designed for the state where everything has data and nothing failed. That state is the rarest one in production.

Every view that fetches needs **four designs**, not one: loading, empty, error, loaded. A view missing any of them is unfinished.

**Loading — choose by duration and layout knowledge.**

| Expected wait | What to show |
| --- | --- |
| < 150ms | Nothing. A flashed spinner is worse than a brief pause. |
| 150ms – 1s | A skeleton if the layout is known; otherwise a quiet inline spinner. |
| 1s – 10s | Skeleton or progress, plus what is happening in words. |
| > 10s | Determinate progress, the ability to leave, and notification on completion. |

- **Skeletons must match the real layout.** A skeleton of the wrong shape causes a visible reflow when data lands — worse than a spinner.
- **Reserve the space before the content arrives.** Never let loaded content push the page around; that is where mis-clicks come from.
- **Keep old data visible while refreshing.** Dim it or show a subtle indicator; blanking the screen on every refetch destroys context.
- **Optimistic updates** for actions that nearly always succeed and are easy to reverse (toggle, reorder, mark done): apply instantly, reconcile after, roll back visibly with an explanation if the server disagrees. Never be optimistic about money, deletion, or anything irreversible.

**Empty — three different situations, three different designs.**
- **Nothing yet (first run):** explain what will appear here and give the action that creates the first one. This is the most under-used teaching moment in any product.
- **Nothing found (filtered):** say which filter is responsible and offer to clear it. Never show "no results" without a way back.
- **Nothing left (completed):** acknowledge it. An emptied queue is a success, not a void.

**Error — be specific and recoverable.**
- State what failed, in the user's terms, and the next step. "Couldn't reach the server — check the connection and try again" beats "Error 500".
- Put a retry where the failure is, not only at the top of the page.
- **Fail at the smallest possible scope.** One failed widget shouldn't blank the dashboard.
- Keep the technical detail available but collapsed — useful to whoever gets the screenshot, invisible to everyone else.
- Never show a raw stack trace or an error code alone.

**Success.**
- Confirm consequential actions; stay silent on trivial ones. A toast for every keystroke-level save is noise.
- Confirmation should be where the action happened, not only in a corner far from the user's attention.
- Pair destructive confirmation with **undo** instead of a prompt wherever the action can be reversed. Undo respects the 95% who meant it; a prompt punishes them for the 5%.

## 18. Tables, lists and dense data

Data-heavy screens are a different craft from marketing surfaces. The goal is scanning speed, not impression.

**Alignment and formatting.**
- **Numbers right-aligned with `tabular-nums`**; text left-aligned; headers match their column's alignment. Misaligned figures cannot be compared by eye.
- Same unit and decimal count down a column. Show the unit once in the header, not in every cell.
- **Dates: fixed format, not "3 days ago"** for records a person will cross-reference. Relative time is for feeds; absolute time is for records. If you show relative, put the absolute in a title attribute.
- Truncate with purpose: the distinguishing part of a string must survive. Truncating identifiers in the middle preserves both ends.

**Density and structure.**
- Dense UI means ~36–44px rows. Generous padding on a 200-row table is a scroll tax.
- **Zebra striping or hairlines, never both.** Striping helps at 6+ columns; below that it's visual noise.
- Sticky header on any list that scrolls past a screen. Sticky first column when horizontal scrolling is unavoidable.
- Right-align the actions column, and keep row actions in a consistent position — a destructive action that moves between rows will eventually be clicked by accident.
- **Virtualize above ~200 rows**, but keep the scrollbar proportional and `Cmd/Ctrl+F` expectations in mind — if the user can't find text that's "on screen", you've broken a basic affordance.

**Interaction.**
- Sorting is a stable, visible, single-click toggle with the direction shown. Multi-sort needs explicit UI, not a hidden modifier.
- Filters show their active state and a one-click clear. A filtered view that looks like an unfiltered empty view is a support ticket.
- Pagination preserves position on back-navigation; infinite scroll breaks "where was I" and should not be used for records people return to.
- Selection survives sorting and paging, and the count is always visible when non-zero.
- Row click target: make the whole row activate the primary action, but keep inner controls from swallowing it.

**Charts in a dense UI** follow the same logic: label directly instead of using a legend where there are few series, start bar axes at zero, and never encode a quantity by colour alone.

## 19. Iconography and microcopy

The words are the interface. Most "confusing UI" is a wording problem wearing a design costume.

**Icons.**
- **An icon alone is ambiguous unless it is universally known** (close, search, back, play). Everything else gets a visible label; icon-only is for repeated, learnable actions in a constrained bar.
- Every icon-only control needs an accessible name and a tooltip. A tooltip is an enhancement, not the accessible name.
- One family, one stroke weight, one optical size. Mixed icon sets read as an unfinished product faster than almost anything else.
- Icons are decorative when paired with text — hide them from assistive tech (`aria-hidden`) so the label isn't announced twice.
- Align by optical weight, not bounding box: a circle must be drawn slightly larger than a square to look the same size.

**Microcopy.**
- **Buttons say what happens: verb + object.** "Save changes", "Delete member", "Register payment" — not "OK", "Submit", "Yes".
- Dialog buttons must be readable without the question. If the title is "Delete this member?", the buttons are "Delete" and "Cancel", never "Yes"/"No".
- Sentence case for everything; Title Case slows reading and ages badly.
- Write to the user as "you"; avoid "we" for system behaviour. The product did it, not a team.
- **No jargon from the implementation.** Users don't have "records", "entities" or "payloads" — they have members, payments and files.
- Numbers: "1 member" / "2 members" — handle the singular; a bare "1 members" reads as broken.
- Never blame the user. "That email is already registered" rather than "You entered an invalid email".
- Keep terminology identical everywhere. If it's a "member" in the table, it is not a "client" in the dialog. One concept, one word, forever.
- Localisation: allow ~30% text expansion in layout, never concatenate sentence fragments, and don't bake the plural rule of one language into the UI.

## 20. Design foundations — the eight principles

The motion and craft above serve Apple's eight design principles (*Principles of Great Design*, WWDC 2026). Use these as the names you reason with:

1. **Purpose.** Make with intention; decide what *not* to build. Every feature asks for the user's time, attention, and trust — spend that budget only where it pays off.
2. **Agency.** Keep people in control: offer choices, don't force a single path. Back it with forgiveness — easy undo for slips, a confirmation dialog only for genuinely destructive, irreversible actions (use sparingly; overusing it trains people to click through).
3. **Responsibility.** Act in the user's interest. Privacy: ask at the right moment, only for what's needed, transparently. Safety: anticipate misuse and harm — especially with AI (an allergy-aware recipe app must not suggest a harmful ingredient). Add previews, confirmations, disclaimers; cut a feature whose risk outweighs its value.
4. **Familiarity.** Build on what people already know. Use metaphors that are neither too literal nor too abstract (a trash can means delete), and honor their physics. Be consistent: things that look the same must behave the same and live in the same place (close is always top-left on macOS) so people can predict what happens next. Only break a familiar pattern if you can prove it's better — then test it, don't assume.
5. **Flexibility.** Design for different contexts, devices, and the full range of abilities. Adapt to the platform (iPhone = quick touch; desktop = deep workflows with precise pointer control) and to the situation. Design inclusively (age, language, expertise, accessibility). When no single layout fits everyone, let people personalize — rearrange controls, hide what they don't use.
6. **Simplicity — not minimalism.** Strip the unnecessary so the core purpose shines; burying everything in one place looks minimal but isn't simple. Be concise (plain language, no jargon, fewer steps) and clear (use hierarchy — order, spacing, contrast — so the most important thing is the most obvious). Every element earns its place; sometimes *adding* context simplifies (a video scrubber that shows time remaining). Show the common path first, advanced options one level deeper.
7. **Craft.** Uncompromising attention to detail builds trust. Beautiful typography, colors that adapt to light/dark, clear iconography, and responsive animations that give immediate, natural feedback. Nothing is random — every spacing, timing, and alignment value is a deliberate choice you can defend. Jittery scroll, misaligned icons, and layouts that break on rotation read as carelessness. Craft needs iteration and longevity — keep evolving the design as features and hardware change.
8. **Delight.** The result of getting the other seven right, not confetti tacked on top. Decide the emotion you want people to feel (calm, confident, excited) and reinforce it in every decision.

Tactical rules that serve these:

- **Feedback comes in four kinds:** status, completion, warning, error. Confirm meaningful actions, expose ongoing status, warn before problems, validate inline (not on submit).
- **Wayfinding.** Every screen should answer: Where am I? Where can I go? What's there? How do I get out? Never trap the user.
- **Grouping & mapping.** Proximity implies relationship; place a control near what it affects and arrange controls to mirror what they change. If you need a label to explain a control, the mapping is weak.
- **Direct, specific labels beat safe generic ones.** Name nav items for their contents ("Progress", "Library"), not vague umbrellas ("Home").  Specificity creates predictability.

## 21. Process

- **Prototype interactively — an interactive demo is worth "a million static designs."** You discover the interface by building and playing with it; a working prototype also sets a concrete bar that prevents a mediocre final implementation.
- **Design interaction and visuals together.** "You shouldn't be able to tell where one ends and the other begins." Motion is not a layer added after the pixels.
- **Test with real people in real context**, and review motion with fresh eyes — play it in slow motion / frame-by-frame to catch what's invisible at full speed.
- **Test on the worst device and the worst network you support**, not the development machine. Fluidity is a property of the slowest frame.
- **Review every screen in both light and dark**, at 200% text, and with the keyboard only. These three passes catch most defects before a user does.

## Quick Reference

| Need | Technique | Concrete value |
| --- | --- | --- |
| Default UI spring | Critically damped, no overshoot | `damping 1.0`, `response 0.3–0.4` |
| Momentum / flick spring | Under-damped, slight bounce | `damping ~0.8`, `response 0.3–0.4` |
| Gesture → spring velocity | Hand off release velocity | `gestureVelocity / (target − current)` if normalized |
| Flick landing point | Project momentum | `current + (v/1000)·d/(1−d)`, `d ≈ 0.998` |
| Interrupt cleanly | Start from presentation (live) value | read the on-screen transform |
| Avoid reversal "brick wall" | Carry velocity through re-target | spring that blends velocity |
| Reversible transition | Mirror the easing curve | inverse cubic-bézier |
| Decide reverse vs. commit | Use velocity **sign**, not position | at release |
| 1:1 drag | Pointer Events + capture | respect the grab offset |
| Feedback | On pointer-down, continuous | never only at the end |
| Acknowledge an action | Visible response | within ~100ms, always |
| Boundary | Rubber-band, don't hard-stop | progressive resistance |
| Translucent chrome | `backdrop-filter` layer | content scrolls under |
| Type tracking | Size-specific, never fixed | tighten large text (`-0.02em`), body near `0` |
| Reduced motion | Cross-fade, not slide/spring | `@media (prefers-reduced-motion)` |
| Validate a field | On blur; re-validate on input once in error | never on first keystroke |
| Invalid form | Submit, then focus the first error | never disable the submit button |
| Focus ring | `:focus-visible`, replace never remove | ≥ 3:1 against its surround |
| Wait < 150ms | Show nothing | a flashed spinner is worse |
| Wait 150ms–1s | Skeleton matching the real layout | reserve the space |
| Refetch | Keep old data, dim it | never blank the view |
| Destructive action | Undo, not a confirm prompt | prompt only if irreversible |
| Numbers in a column | Right-aligned + `tabular-nums` | same decimals throughout |
| Dates in records | Absolute format | relative only in feeds |
| Long list | Virtualize above ~200 rows | sticky header |
| Icon-only control | Accessible name + tooltip | only for universal icons |
| Button label | Verb + object | "Save changes", never "OK" |

## Review checklist

Before calling a screen done:

1. Does anything the user touches respond within ~100ms?
2. Can every animation be interrupted and reversed mid-flight?
3. Do things leave the way they arrived?
4. Loading, empty, error and loaded — are all four designed?
5. Light and dark, both checked?
6. Full keyboard pass: reachable, visible focus, sane order, no trap?
7. Is colour ever the only carrier of meaning?
8. Contrast measured, not guessed?
9. 200% text — does it reflow or clip?
10. `prefers-reduced-motion` — gentler, not broken?
11. Every button a verb; every term the same word everywhere?
12. Tested on the slowest device you support?
