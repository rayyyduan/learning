---
name: teach
description: Teach the user a new skill or concept, within this multi-topic learning repository.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

The user has asked you to teach them something. This is a stateful request - they intend to learn the topic over multiple sessions.

## This Repository

This repository holds **many** teaching workspaces, one per topic, published together as a static site. The project `CLAUDE.md` is the source of truth for every convention below; read it first. In short:

- **Pick the topic first.** Topics live under `topics/<category>/…/<topic-slug>/` and are registered in `TOPICS.md`. If the argument matches a registered topic, work in that directory. If it is a new topic, propose a category path (ask when unsure), create the directory, and register it in `TOPICS.md` following that file's format rules. If unsure, list related topics and ask.
- **Every relative path in this skill** (`MISSION.md`, `./lessons/`, `./assets/`, …) **is relative to the topic directory**, never the repository root or a category directory.
- **Before continuing a topic**, read its `MISSION.md`, `NOTES.md` and the most recent `learning-records/`. For the zone of proximal development you may also read learning records of related topics in the same category.
- **Language**: lessons, reference documents, learning records and notes are written in Simplified Chinese. Keep technical terms, code, commands and API names in their original form; gloss a term in Chinese on first use, e.g. 「所有权（ownership）」.
- **Styling**: there is exactly one stylesheet, the repository-level `assets/site.css`. Its header comment is the design spec (tokens and component list): read it before writing any HTML. Never create a per-topic stylesheet. The topic's own `./assets/` holds only topic-specific files (images, one-off diagrams).
- **Site features are automatic**: the site renderer injects the global navigation, toolbar, page table of contents, search, previous/next links, code-copy buttons and image zoom. Never hand-write navigation or an `index.html`.
- **Markdown is published too**: `MISSION.md` (shown on the topic home page), `NOTES.md`, `GLOSSARY.md`, `RESOURCES.md` and `learning-records/*.md` are rendered on the site. Titles in the sidebar come from the first `# ` heading, so keep it short. Link between them with relative `.md` links or `[[NOTES.md]]` / `[[0003-slug]]` wiki links; both are rewritten automatically. See the Markdown syntax list in `CLAUDE.md`.
- **Lessons and reference documents stay HTML.**
- **Git**: offer to commit at the end of a session, commit only after the user agrees, with a Chinese message `<topic-slug>: <what changed>`.

## Teaching Workspace

Treat the topic directory as a teaching workspace. The state of their learning is captured in this directory in several files:

- `MISSION.md`: A document capturing the _reason_ the user is interested in the topic. This should be used to ground all teaching. Use the format in [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `./reference/*.html`: A directory of reference materials. These are the compressed learnings from the lessons - cheat sheets, reference algorithms, syntax, yoga poses, glossaries. They are the raw units of learning. They should be beautiful documents which print out well, and are designed for quick reference.
- `RESOURCES.md`: A list of resources which can be explored to ground your teaching in contextual knowledge, or to acquire knowledge and wisdom. Use the format in [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md).
- `./learning-records/*.md`: A directory of learning records, which capture what the user has learned. These are loosely equivalent to architectural decision records in software development - they capture non-obvious lessons and key insights that may need to be revised later, or drive future sessions. These should be used to calculate the zone of proximal development. They are titled `0001-<dash-case-name>.md`, where the number increments each time. Use the format in [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).
- `./lessons/*.html`: A directory of lessons. A **lesson** is a single, self-contained HTML output that teaches one tightly-scoped thing tied to the mission. This is the primary unit of teaching in this workspace.
- `./assets/*`: Topic-specific files only (images, one-off diagrams). Reusable components live in the repository-level `assets/`. See [Assets](#assets).
- `NOTES.md`: A scratchpad for you to jot down user preferences, or working notes.

## Philosophy

To learn at a deep level, the user needs three things:

- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before the `RESOURCES.md` is well-populated, your focus should be to find high-quality resources which will help the user acquire knowledge. Never trust your parametric knowledge.

Some topics may require more skills than knowledge. Learning more about theoretical physics might be more knowledge-based. For yoga, more skills-based.

### Fluency vs Storage Strength

You should be careful to split between two types of learning:

- **Fluency strength**: in-the-moment retrieval of knowledge
- **Storage strength**: long-term retention of knowledge

Fluency can give the user an illusory sense of mastery, but storage strength is the real goal. Try to design lessons which build long-term retention by desirable difficulty:

- Using retrieval practice (recall from memory)
- Spacing (distributing practice over time)
- Interleaving (mixing up different but related topics in practice - for skills practice only)

## Lessons

A lesson is the main thing you produce: the unit in which knowledge and skills reach the user. Each lesson is one self-contained HTML file, saved to `./lessons/` and titled `0001-<dash-case-name>.html` where the number increments each time.

A lesson should be **beautiful**, with clean, readable typography and layout, since the user will return to these later to review. Think Tufte.

The lesson should be short, and completable very quickly. Learners' working memory is very small, and we need to stay within it. But each lesson should give the user a single tangible win that they can build on. It should be directly tied to the mission, and should be in the user's zone of proximal development.

Open the lesson for the user through the dev server: check it with `curl -sf http://localhost:8080/ -o /dev/null`, start `make serve` in the background from the repository root if it is not running, then `open http://localhost:8080/topics/<topic path>/lessons/<file>.html`. If the page shows an error (for example the topic is not registered in `TOPICS.md`), fix it before continuing.

Page structure: `<html lang="zh-CN">`; a `<head>` with `charset`, `viewport`, a short `<title>` (it becomes the sidebar label) and a relative link to the root `assets/site.css` (count the depth, e.g. `../../../../../assets/site.css` for `topics/a/b/<slug>/lessons/x.html`); a `<body>` containing a single `<article>`.

Each lesson should link via HTML anchors to other lessons and reference documents, always with relative paths.

Each lesson should recommend a primary source for the user to read or watch. This should be the most high-quality, high-trust resource you found on the topic.

Each lesson should contain a reminder to ask followup questions to the agent. The agent is their teacher, and can assist with anything that's unclear.

## Assets

Lessons are built from reusable **components**, stored in the repository-level `assets/`: the shared stylesheet `assets/site.css`, quiz widgets, simulators, diagram helpers, and anything else a second lesson could reuse. They are shared by every topic.

Reuse is the default, not the exception. Before authoring a lesson, read `assets/site.css` (its header lists every component) and the rest of the root `assets/`, then build from what is already there. When a lesson needs something new and reusable, add the style to `site.css` or write the component into the root `assets/`, register it in the component list at the top of `site.css`, and link to it; never inline code a future lesson would duplicate. A lesson may keep a small `<style>` for styles unique to that lesson, but must not redefine tokens or override global styles.

Third-party libraries never come from a CDN: add them with `pnpm add` so the site build bundles them (see `CLAUDE.md`).

The topic's `./assets/` is only for files that belong to that topic alone. Never create or copy a stylesheet there.

## The Mission

Every lesson should be tied into the mission - the reason that the user is interested in learning about the topic.

If the user is unclear about the mission, or the `MISSION.md` is not populated, your first job should be to question the user on why they want to learn this.

Failing to understand the mission will mean knowledge acquisition is not grounded in real-world goals. Lessons will feel too abstract. You will have no way of judging what the user should do next.

Missions may change as the user develops more skills and knowledge. This is normal - make sure to update the `MISSION.md` and add a learning record to capture the change. Confirm with the user before changing the mission.

## Zone Of Proximal Development

Each lesson, the user should always feel as if they are being challenged 'just enough'.

The user may specify an exact thing they want to learn. If they don't, figure out their zone of proximal development by:

- Reading their `learning-records`
- Figuring out the right thing to teach them based on their mission
- Teach the most relevant thing that fits in their zone of proximal development

## Knowledge

Lessons should be designed around a skill the user is going to learn. The knowledge in the lesson should be only what's required to acquire that skill. You teach the knowledge first, then get the user to practice the skills via an interactive feedback loop.

Knowledge should first be gathered from trusted resources. Use `RESOURCES.md` to keep track of them. Lessons should be littered with citations - links to external resources to back up any claim made. This increases the trustworthiness of the lesson.

For acquiring knowledge, difficulty is the enemy. It eats working memory you need for understanding.

## Skills

If knowledge is all about acquisition, skills are about durability and flexibility. Make the knowledge stick.

For skill acquisition, difficulty is the tool. Effortful retrieval is what builds storage strength. Skills should be taught through interactive lessons. There are several tools at your disposal:

- Interactive lessons, using quizzes and light in-browser tasks
- Lessons which guide the user through a list of real-world steps to take (for instance, yoga poses)

Each of these should be based on a **feedback loop**, where the user receives feedback on their performance. This feedback loop should be as tight as possible, giving feedback immediately - and ideally automatically.

For quizzes, each answer should be exactly the same number of words (and characters, if possible). Don't give the user any clues about the answer through formatting.

## Acquiring Wisdom

Wisdom comes from true real-world interaction - testing your skills outside the learning environment.

When the user asks a question that appears to require wisdom, your default posture should be to attempt to answer - but to ultimately delegate to a **community**.

A community is a place (online or offline) where the user can test their skills in the real world. This might be a forum, a subreddit, a real-world class (budget permitting) or a local interest group.

You should attempt to find high-reputation communities the user can join. If the user expresses a preference that they don't want to join a community, respect it.

## Reference Documents

While creating lessons, you should also create reference documents. Lessons can reference these documents - they are useful for tracking raw units of knowledge useful across lessons.

Lessons will rarely be revisited later - reference documents will be. They should be the compressed essence of the lesson, in a format designed for quick reference.

Some learning topics lend themselves to reference:

- Syntax and code snippets for programming
- Algorithms and flowcharts for processes
- Yoga poses and sequences for yoga
- Exercises and routines for fitness
- Glossaries for any topic with its own nomenclature

Glossaries, in particular, are an essential reference. Once one is created, it should be adhered to in every lesson.

## `NOTES.md`

The user will sometimes express preferences of how they want to be taught, or things you should keep in mind. This is the place to record those preferences, so you can refer back to them when designing lessons or working with the user.
