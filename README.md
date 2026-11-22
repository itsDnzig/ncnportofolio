# VIVTUS — Portofolio Swiss Editorial Minimalist

Portofolio pribadi gaya *Swiss Editorial / Dark Studio Mode*. Tanpa build step —
HTML5 + Tailwind (CDN) + Vanilla JS + GSAP (CDN).

## Struktur

```
portofolio/
├── index.html        Markup halaman (top bar, hero, index, modal, panel)
├── style.css         Seluruh styling & design tokens
├── script.js         Render dari JSON, filter, cursor preview, modal, panel
├── projects.json     Data 6 proyek (2×3D Art, 2×Motion, 2×Editing)
└── assets/
    ├── CV.pdf        Tombol download di panel Info & Contact
    ├── img/          Poster + galeri breakdown (wireframe/process)
    └── video/        p*.mp4 (preview) & d*.mp4 (detail)
```

## Menjalankan

`fetch('projects.json')` tidak jalan lewat `file://`, jadi wajib server lokal:

```bash
cd Desktop/portofolio
python -m http.server 8787
# buka http://127.0.0.1:8787
```

## Mengedit data

Semua konten ada di `projects.json`. Skema tiap proyek:

```json
{
  "id": "01",
  "title": "Judul",
  "category": "3D ART | MOTION | EDITING",
  "year": 2025,
  "client": "...",
  "description": "...",
  "software": ["Blender", "After Effects"],
  "previewVideo": "./assets/preview-01.mp4",
  "youtubeId": "VIDEO_ID_YOUTUBE",
  "breakdownImages": ["./assets/img/g1-1.jpg", "..."]
}
```

**Video utama** di modal memakai embed YouTube (`youtubeId`), `previewVideo`
untuk float preview saat hover, dan `breakdownImages` untuk galeri breakdown.

**Identitas & kontak** diedit langsung di `index.html` (top bar, hero, footer,
panel Info & Contact). Warna/font di token `:root` pada `style.css`.

## Perilaku

- Floating preview (`#cursor-preview`) hanya aktif di perangkat hover (desktop).
  Di mobile otomatis nonaktif dan diganti thumbnail di dalam baris list.
- Filter kategori me-*render ulang* list dan memperbarui penomoran.
- Modal & panel menahan fokus (focus trap) dan bisa ditutup dengan `Esc`.
- Mendukung `prefers-reduced-motion`.
