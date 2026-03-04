# Favicon — ChatGPT Image Generator Prompt

Use this prompt with ChatGPT (GPT-4o image generation / DALL·E 3) to generate a favicon for the Bengaluru Walkability Audit app.

---

## Prompt

```
A minimalist square app icon / favicon for a civic walkability reporting app called "Bengaluru Walkability Audit".

The icon should work at very small sizes (16×16 and 32×32 pixels), so it must be extremely simple — a single bold, readable symbol with no text and no fine details.

Design spec:
- Background: solid flat green, hex #16a34a
- Foreground symbol: white
- The symbol is a stylised walking pedestrian figure combined with a location pin — specifically: a simple bold map pin shape (teardrop / inverted drop) with a small white walking stick figure silhouette centred inside the pin body
- The walking figure should face forward or be shown mid-stride in strict silhouette — no face, no clothing details, just a bold geometric shape
- The pin outline should have a thick white stroke so it reads clearly on the green background
- Style: flat design, no gradients, no shadows, no glow, no 3D effects, no textures — pure vector-flat
- The overall composition should be square (1:1 ratio), with the pin centred and occupying roughly 70% of the canvas height
- Rounded square / squircle outer frame (like an iOS app icon) is acceptable but optional
- Do NOT include any text, letters, or numerals
- Do NOT use red (associated with danger/error); stick to white on green
- Output as a square image at 512×512 pixels minimum
```

---

## What to do with the output

1. Save the generated image as a PNG (512×512 or larger)
2. Convert it to `.ico` format using any free converter (e.g., favicon.io, convertio.co, or ImageMagick: `convert icon.png -resize 32x32 favicon.ico`)
3. Place the resulting `favicon.ico` at: `frontend/app/favicon.ico`
4. Optionally also save a `icon.png` (192×192) at `frontend/app/icon.png` for PWA home screen use

Next.js App Router will auto-serve `frontend/app/favicon.ico` at `/favicon.ico` with no code changes needed.

---

## Alternative / backup prompt (simpler, even more readable at tiny sizes)

```
A minimalist square favicon icon. Solid flat green background (#16a34a). A single white bold footstep / footprint silhouette centred on the square — one foot, top-down view, simple geometric shape. Flat design, no gradients, no shadows, no text. 512×512 pixels, square canvas.
```

Use the backup prompt if the primary prompt produces something too detailed to read at 16×16.
