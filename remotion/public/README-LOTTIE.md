# Assets for Each Scene

Each scene uses **Lottie animations** and/or **PNG images** from this folder.

## Current Assets (from your Assest folder)

| Asset | Type | Used in |
|-------|------|---------|
| `worried-expression-character.png` | PNG | Hook, Reality, Problem |
| `packaging-for-delivery.json` | Lottie | Wish, Result |
| `business-salesman.json` | Lottie | Solution, Closing |
| `business-book.png` | PNG | Solution |
| `person-buys-online.png` | PNG | Result |
| `business-analysis.json` | Lottie | (available, not yet used) |

## Add Your Own Lotties

1. Go to [lottiefiles.com/free-animations](https://lottiefiles.com/free-animations)
2. Download as **Lottie JSON**
3. Save in this folder and update `SceneLottie.tsx` to reference the filename.

## Behavior

- **Local files override CDN URLs.** JSON files in this folder are used automatically when referenced in `SceneLottie.tsx`.
- PNG images are used via the `SceneImage` component with `staticFile('filename.png')`.
