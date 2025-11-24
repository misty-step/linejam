# TODO

## Pending Tasks

- [x] Implement Rotation Wiggle animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (hover state)
  - app/globals.css (add keyframe animation)

  Pattern: Button rotates ±0.5deg on hover, matching stamp -5deg rotation aesthetic

  Context: Stamps in the design system use -5deg rotation. Buttons should subtly wiggle on hover like stamps being positioned before pressing. Creates playful anticipation.

  Approach:
  1. Add keyframe animation to globals.css:
     ```css
     @keyframes stamp-wiggle {
       0%, 100% {
         transform: rotate(0deg);
       }
       25% {
         transform: rotate(-0.5deg);
       }
       75% {
         transform: rotate(0.5deg);
       }
     }
     ```
  2. Update Button.tsx hover state:
     ```tsx
     'hover:animate-[stamp-wiggle_0.8s_ease-in-out_infinite]',
     ```
  3. Ensure rotation doesn't conflict with scale/translate transforms
  4. Apply to primary buttons only

  Success criteria: Button wiggles ±0.5deg in 800ms cycle. Feels like stamp being positioned. Subtle and playful, not distracting. Stops on active press. Doesn't cause layout shift of surrounding elements.

  Edge Cases:
  - Transform composition - rotation must combine with scale/translate
  - Text readability - 0.5deg should not affect legibility
  - Mobile - may be too subtle on small screens, consider disabling

  Dependencies:
  - Must compose with other transform animations
  - Should respect prefers-reduced-motion

  NOT in Scope:
  - Different rotation degrees per button size
  - Direction variation (always ±0.5deg)

  Estimate: 40m

  ```

  ```

  ````

- [ ] Implement Ink Spread on Hover animation

  ````
  Files:
  - components/ui/Button.tsx:14-51 (hover background)
  - app/globals.css (add keyframe animation)

  Pattern: Radial gradient expands from center outward on hover like ink soaking into paper

  Context: Hover state needs background transition that feels organic. Radial gradient spreading creates ink-on-paper metaphor. Should be subtle, visible as darkening/lightening rather than color change.

  Approach:
  1. Add CSS custom property for hover gradient:
     ```css
     /* In @theme section of globals.css */
     --gradient-ink-spread: radial-gradient(
       circle at center,
       rgba(232, 93, 43, 0.08) 0%,
       rgba(232, 93, 43, 0.04) 50%,
       transparent 100%
     );
     ```
  2. Add keyframe animation:
     ```css
     @keyframes ink-spread {
       from {
         background-size: 0% 0%;
         background-position: center;
       }
       to {
         background-size: 200% 200%;
         background-position: center;
       }
     }
     ```
  3. Update Button.tsx hover state:
     ```tsx
     'relative overflow-hidden',
     'before:absolute before:inset-0 before:bg-[var(--gradient-ink-spread)]',
     'before:animate-[ink-spread_0.6s_ease-out] before:opacity-0',
     'hover:before:opacity-100',
     ```

  Success criteria: Gradient expands from button center on hover in 600ms. Creates subtle darkening/tinting effect. Feels like ink spreading. Doesn't obscure button text. Works with existing button backgrounds.

  Edge Cases:
  - Button variants - gradient tint may need adjustment per variant
  - Text contrast - ensure text remains WCAG AA compliant
  - Rapid hover on/off - animation should reset gracefully

  Dependencies:
  - Requires before: pseudo-element support
  - Must layer correctly with button content (z-index)

  NOT in Scope:
  - Click origin tracking for spread direction
  - Different spread speeds
  - Color variation per button variant (all use persimmon)

  Estimate: 1h

  ```

  ```
  ````
