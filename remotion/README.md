# ClientForge — 30-Second Lifestyle Explainer Video

A lifestyle-style explainer video built with [Remotion](https://remotion.dev). Features **different Lottie characters per scene** discussing the struggle of nurturing clients and how ClientForge helps.

**Format:** 1080×1920 portrait (iPhone / Reels / Stories)

## Quick Start

```bash
cd remotion
npm install
npm start
```

Opens Remotion Studio at http://localhost:3000 — scrub the timeline to preview.

## Render to MP4

```bash
npm run build
```

Output: `out/explainer.mp4`

---

## Scene Structure (7 scenes, 30 seconds)

| # | Scene | Duration | Text |
|---|-------|----------|------|
| 1 | **Hook** | 4s | "Every client that leaves is a client you could've kept." |
| 2 | **Reality** | 4s | "You're busy. Follow-ups slip. Clients drift away." |
| 3 | **Wish** | 4s | "What if they came back on their own?" |
| 4 | **Problem** | 4s | "But who has time to nurture everyone?" |
| 5 | **Solution** | 5s | "ClientForge handles the follow-up — automatically." |
| 6 | **Result** | 5s | "You focus on your business. We bring them back." |
| 7 | **Closing** | 4s | "Stop losing clients. Start nurturing them." + CTA |

---

## Lottie Characters

Each scene uses a **different Lottie character** (loaded from LottieFiles CDN). To use your own:
1. Download JSON from [lottiefiles.com](https://lottiefiles.com)
2. Add to `public/` as `scene-1-hook.json`, `scene-2-reality.json`, etc.
3. Update `src/components/SceneLottie.tsx` to use `staticFile()` for local files

---

## Project Structure

```
remotion/
├── src/
│   ├── index.ts
│   ├── Root.tsx
│   ├── ClientForgeExplainer.tsx
│   ├── components/
│   │   ├── BusinessOwnerCharacter.tsx  # Illustrated character (4 moods)
│   │   ├── AnimatedText.tsx
│   │   ├── FloatingBackground.tsx
│   │   ├── SceneTransition.tsx
│   │   └── Logo.tsx
│   └── scenes/
│       ├── HookScene.tsx
│       ├── RealityScene.tsx
│       ├── WishScene.tsx
│       ├── ProblemScene.tsx
│       ├── SolutionScene.tsx
│       ├── ResultScene.tsx
│       └── ClosingScene.tsx
```

---

## How to Edit Text

| Scene | File | Key text |
|-------|------|----------|
| Hook | `HookScene.tsx` | "Every client that leaves..." |
| Reality | `RealityScene.tsx` | "You're busy. Follow-ups slip..." |
| Wish | `WishScene.tsx` | "What if they came back..." |
| Problem | `ProblemScene.tsx` | "But who has time..." |
| Solution | `SolutionScene.tsx` | "ClientForge handles the follow-up..." |
| Result | `ResultScene.tsx` | "You focus on your business..." |
| Closing | `ClosingScene.tsx` | "Stop losing clients..." + CTA |

---

## Voiceover

Text is written for easy VO sync. Each scene has 1–2 short sentences. Add voiceover later by importing audio and using Remotion's `<Audio>` component or by replacing in post.

---

## Specs

- **Resolution:** 1080×1920 (portrait, mobile)
- **Frame rate:** 30 fps
- **Duration:** 30 seconds (900 frames)
