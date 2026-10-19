# Colin's taste — living profile

Captured: **2026-10-19**. Version 1. This is an evolving design profile, not a
claim about personal character. Capture dates below are not original message
dates unless a source supplies one.

## Current read

The strongest supported direction is **a distinctive, lively setting around a
simple action**. Blocks can become a richly inhabited night street while minting
gets simpler. Ghoulballs can feel like a small arcade machine whose artwork
escapes into the browser tab. Numerate can feel handmade and computational
without looking like a generic wallet dashboard.

Generalize the care, coherence and small surprises; choose the visual language
for the audience. Pixel art, neon, terminals and atmospheric worlds are useful
families here, not requirements for every project.

## Confirmed preferences

Source **CHAT** means direct feedback in the sol_vid conversation, captured on
2026-10-19. Short quotations retain the original meaning. IDs stay stable so
later feedback can refine rather than duplicate them.

| ID | Preference and scope | Evidence |
| --- | --- | --- |
| T01 | A themed, animated browser-tab icon is a valued detail. Derive the mark from the project's identity or artwork. Supported across ghoulballs and blocks. | CHAT: "the same animated ico trick as for the ghoulballs but themed for this". Exact mechanism and browser coverage are implementation details. |
| T02 | Blocks should feel like entering a place, with depth, movement and a strong sense of atmosphere. | CHAT: "feel like we're walking down a super modernist street in tokyo at night"; "lots of fancy immersive stuff and cyberpunk themes". |
| T03 | In blocks' world, push bright colour, signs and environmental detail further. | CHAT: "way more cyberpunk with bright colors and signs"; "UI can go even busier, more signs and features". This does not establish a preference for cluttered forms. |
| T04 | Keep minting very simple even when the surroundings are elaborate. Choose available data automatically rather than asking for unnecessary inputs. | CHAT: "really simple minting experience"; "mint function ... should not take input values"; "One block per NFT, with mint() choosing it automatically". |
| T05 | Ghoulballs should retain the original vaporwave feel while gaining generative balls and motion styles. | CHAT: "more closely match your original vaporwave, but with generative balls and animation styles". Exact hex values were not endorsed. |
| T06 | Generative work needs visible variety, not just different seeds or near-identical outputs. | CHAT: "NFTs need lots of variation"; "enough difference visually for minimal overlap on a 100k mint". Collection-wide visual diversity matters. |
| T07 | Bring the actual project into its presentation: minted artworks, clearly labelled demos and chain state can inhabit the world. | CHAT: "information ... about the state of the chain" and "sprinkle minted NFTs (or demo ones before they're minted) throughout the world". No invented live data. |
| T08 | Small-media and constrained-rendering experiments are part of the appeal of these NFT projects. | CHAT asks for video fully rendered by a Solidity static call, explores AVI/MPEG/GIF and explicitly approves working AVI. Scope: onchain art; this is not a universal ban on hosted assets. |

No explicit universal dislikes are recorded yet. Do not manufacture a negative
list from these positive preferences.

## Cross-project evidence and boundaries

Sibling paths below resolve from `~/dev/_projects`. These are bounded samples
of first-party source and project direction, not an exhaustive review of every
repo. Contract libraries, dependency examples and private research were excluded.

| Project | State | What it contributes | Boundary / source |
| --- | --- | --- | --- |
| `sol_vid` / blocks | Confirmed direction + observed implementation | Neon depth, signs, pixel artwork, an animated miniature city-block icon, a simple mint action. | T01–T04, T07. `blocks-page/dist/favicon.mjs`, `blocks-page/dist/style.css`, `blocks-page/README.md` §Icons. Current uncommitted street work is an in-progress example, not separately approved. |
| `sol_vid` / ghoulballs | Confirmed direction + observed implementation | Vaporwave artwork inside warm arcade chrome; the favicon follows the actual collection/token artwork. | T01, T05, T06. `mint-page/dist/style.css:1`, `mint-page/dist/favicon.js`, `mint-page/README.md` §Icons, `src/Vaporwave.sol`. Do not confuse UI colours with artwork palettes. |
| `numerate_www` | Documented direction + observed implementation | A handmade HTML / MS-DOS text-mode CRT direction, pastel phosphors, custom wallet presentation and a theme-aware pixel mark. | `docs/PLAN.md:5`, `app/globals.css:6`, `lib/favicon.ts`, `lib/favicon-pixels.json`. Its pixel icon changes phosphor with the theme; this source alone does not prove it animates. |
| `ghoul_date` | Documented tone + observed implementation | Arcade cabinet, crisp portraits, warm bone/orange/yellow, Pixelify Sans, deliberate press feedback. Playful ghoul humour with cartoon substitutions rather than graphic gore. | `apps/web/app/globals.css:1`, `docs/CODEX_HANDOVER.md` §Art tone and effects, `docs/ART_TONE.md`. Tone is documented secondary evidence. Scope is this ghoul project, not a universal rule for horror. |
| `ghoulBalls` | Observed | Simple circles, entropy-selected colours and native onchain animation. | `src/libImg.sol:41`, `src/animatedGhoulBalls.sol:38`. Sparse project context; no evidence of a preferred fixed palette or favicon. |
| `pos_swap` | Observed | Dense, task-driven console: blue/purple/green phosphor colours, monospace metrics, status grids and a paper theme. | `apps/web/src/app/styles.css:1`, `docs/brand/teletype.html`. Data density is appropriate to an operator's task; not a blanket preference for dense layouts. |
| `_maeva` | Observed counterexample | Bright tropical water, soft translucent controls, rounded Fredoka type and a full-screen touch game. | `src/style.css:1`, `index.html`. Supports flexibility in visual language; does not establish an endorsement of every game detail. |
| `3_mer` | Documented project criteria | Photographic neutrality, source-data fidelity, aerial depth, stable motion and physically plausible light. | `docs/visual-rubric.md:3`. Its rubric explicitly rejects conspicuous colour grading and game-like saturation. Do not add the NFT projects' neon to this simulation. |

Protocol-only repositories, dependency trees and bot implementations were not
treated as evidence of visual taste. Workout records and other personal data
were not sampled. A repo's presence does not mean all its design is liked.

## Palette families — source samples, not mandatory tokens

Choose one relevant family and give each colour a role. Do not combine every
family into a rainbow. Confirmed feedback supports bright cyberpunk colour for
blocks and vaporwave for ghoulballs; the exact samples below are **observed**.

| Family | Background / surface | Text | Accents | First-party source |
| --- | --- | --- | --- | --- |
| Blocks / neon night | `#090713` | `#edf6f5` | cyan `#46f5ff`, pink `#ff32b5`, amber `#ffb51b` | `sol_vid/blocks-page/dist/style.css:1` |
| Ghoul / warm arcade | `#070708`, panel `#211d28` | bone `#fff1c7` | orange `#ff9d18`, yellow `#ffd226`, purple `#8d36d8`, green `#6ee236` | `sol_vid/mint-page/dist/style.css:1`; matching tokens in `ghoul_date/apps/web/app/globals.css` |
| Numerate / pastel phosphor | screen `#15141f`, paper `#faf7ee` | ink `#1b1b25` in daylight | mint `#bff0d4`, lilac `#d9ccff`, butter `#fff1a8`, bubble `#ffc8e3` | `numerate_www/app/globals.css:6` |
| pos_swap / operator console | `#05060e`, panel `#0b0e1c` | blue `#5bb8ff` | purple `#bd8cff`, green `#4dff88`; paper `#ece7da` | `pos_swap/apps/web/src/app/styles.css:1` |
| _maeva / tropical play | water `#1aa9cf` | ink `#0b3954` | aqua `#22d3c5`, purple `#b784ff`, translucent white controls | `_maeva/src/style.css:1` |

For `3_mer`, choose colours from the actual reference scene and lighting;
inventing a fixed "realism palette" would contradict the point of its rubric.

The two sol_vid static sites keep their first-party page source under `dist/`;
there is no separate upstream stylesheet to cite. Blocks' neon palette sample
is from the in-progress street revision captured on this date, not a claim
that those exact values are deployed or separately approved.

The atlas embeds static copies of `sol_vid/blocks-page/dist/assets/favicon.png`
and `sol_vid/mint-page/dist/assets/apple-touch-icon.png`, plus Numerate's pixel
mark from `lib/favicon-pixels.json` using its mint-phosphor colours.

## Craft defaults to try — observed / proposed

These are useful working hypotheses, not new confirmed likes:

- **Tiny living identity.** A recognisable mark at 16–32px, with limited motion
  where supported. Blocks has moving windows; ghoulballs uses token frames;
  Numerate follows the phosphor theme. Static ICO/PNG/touch assets remain useful.
  "Animated ICO" is the user's shorthand, not a requirement for an animated
  `.ico` file; the NFT pages swap rendered PNG favicon frames.
- **Type with a role.** Pixel lettering for an arcade voice, readable mono for
  numbers and terminal text, conventional readable text where appropriate.
  Existing examples include Pixelify Sans, Jersey 10, VT323, JetBrains Mono,
  Doto and Fredoka. These are observed choices, not an approved font whitelist.
- **Motion with a job.** Loops, cursors, windows, traffic and feedback should
  make the object or world feel alive. Generative motion should differ visibly.
  Smooth realistic simulation and deliberate pixel steps are different goals.
- **Coherent custom details.** Match wallet UI, loading states, favicons, empty
  states and downloads to the world rather than stopping at a decorated hero.
  Prefer the project's artwork and data over unrelated stock illustrations.
- **Environmental richness, clear decisions.** Add texture around the action;
  simplify the action itself. A dense trading console is a different task from
  a mint button or touch game. Preserve clear focus, errors and status.
- **A measured critique.** Point to the weak region, behaviour or missing depth
  cue. The marine rubric is a useful example of actionable visual judgment;
  adopting this critique style is a proposal, not proof of a personal preference.

Reduced motion, readable contrast, keyboard access, opt-in sound where relevant,
static fallbacks and performance are delivery requirements to evaluate, not
evidence that the user explicitly requested each detail in every project.

## Updates

| Captured | Change | Basis |
| --- | --- | --- |
| 2026-10-19 | Initial T01–T08; contextual families and counterexamples. | Direct sol_vid conversation; bounded read-only samples of the project families above. |

For future entries, preserve the ID or add one, record the narrow context and
evidence state, then note the new feedback here. Mark superseded entries
retired with a reason. Keep tentative interpretations tentative.
