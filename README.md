# CV 3D

A 3D interactive portfolio and résumé website for Abolfazl Javadinia. The site combines a responsive single-page interface with a Three.js scene, project and experience sections, theme switching, and a printable résumé view.

## Tech stack

- Vite
- Three.js
- Vanilla JavaScript and CSS

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. Run `npm run build` first. |

## Project structure

```text
src/
  main.js       Application entry point
  scene/        Three.js scene, formations, textures, and theme
  styles/       Global styles and page sections
  ui/           Navigation, theme, keyboard palette, and other interactions
index.html      Page markup and metadata
docs/           Project design specification
```

The production output and installed dependencies are generated locally and are not committed.
