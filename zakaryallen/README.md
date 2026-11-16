# Zakary Allen: 3D recruiting site

A rebuild of zakaryallen.com as a fast, static 3D site. All content from the original is kept and grouped into sections: socials, measurables, throwing metrics, film, coach's thoughts, events, about, and contact.

- **3D background** (three.js): a spiraling football with laces flies over a night-lit field. The camera moves downfield as you scroll, and the scene follows the mouse.
- **3D tilt cards**, numbers that count up, and animated metric gauges.
- **YouTube videos load only when clicked**, so the page stays fast.
- The **contact form** opens the visitor's email app, addressed to zakkallenn@gmail.com.
- Works on phones, and respects the reduced-motion setting.

## Run / deploy
It's a static site. Upload `index.html`, `styles.css` and `main.js` to any host (Netlify, Vercel, GitHub Pages, GoDaddy file hosting).

```bash
npm install
npm run build   # bundles src/ into main.js
npm run serve   # http://localhost:8080
```

To update a stat, edit the numbers in `index.html`. Photos are still hosted on the original GoDaddy image server.
