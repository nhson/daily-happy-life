# Meaningful-Life App: Pre-Build Research

_Researched 2026-11-03. Bracketed numbers refer to the Sources list. "Unverified" marks claims I could not trace back to a primary source._

## 1. Which book is it?

| Candidate | Authors / publisher | Fit | Confidence |
|---|---|---|---|
| **How to Live a Meaningful Life: Using Design Thinking to Unlock Purpose, Joy, and Flow Every Day** | Bill Burnett & Dave Evans; Simon & Schuster; pub. **Feb 3, 2026** [1][2][3] | The title matches exactly. Same authors as the Odyssey Plan. | **High (~90%)** that this is the book the user means |
| Designing Your Life: How to Build a Well-Lived, Joyful Life | Burnett & Evans; Knopf, Sept 2016 [4][5] | This is where **Odyssey Plans**, the Compass, the Dashboard and the Good Time Journal come from. | High that the Odyssey ideas come from here |
| The Designing Your Life Workbook (2021) / Designing Your New Work Life (2020) | Burnett & Evans; Penguin Random House [6][3] | Companion volumes that reuse the same tools | Low as "the book" |

The authors' own site lists the new book as the latest in the series [3]. It structures meaning around **four sources: Wonder, Coherence, Flow, Community** [7][8]. It also sets out five **"Designer's Way" mindsets**: Wonder, Availability, Radical Acceptance, Fully Engaged & Calmly Detached, and Create Your World [8]. The publisher frames it as tools to "build purpose, clarity, and connection without quitting your job or blowing up your life" [2]. Reviews mention practical "Try Stuff" exercises and heavy overlap with the earlier books (unverified detail) [9]. **I found no source confirming that the new book itself contains the Odyssey Plan.** The user has most likely combined the two books, and the app should draw on both.

## 2. Frameworks, framed as app data

| Tool | Source | Inputs (what the app captures) | Cadence | Output |
|---|---|---|---|---|
| **Workview + Lifeview → Compass** | DYL [10] | Two short essays (~250 words each): why work, and what gives life meaning. Plus a note on where they agree or conflict ("coherence") | One-off, revisited about once a year | The "north star" text shown in reminders; the reference for coherence checks |
| **Health / Work / Play / Love Dashboard** | DYL [10][11] | Self-rating of each area (0 to full gauge) plus a short note | Monthly or quarterly | Balance snapshot and trend; shows which area to design for |
| **Good Time Journal** | DYL [10][11] | For each activity: **engagement** (low/high) and **energy** (+/-), flow flag. Weekly reflection with **AEIOU** (Activities, Environments, Interactions, Objects, Users) | Daily log for about 3 weeks, weekly reflection | Patterns of what energises or drains you; input for Odyssey Plans |
| **Odyssey Plans** | DYL [12][10] | 3 alternative 5-year lives (Life 1 current path, Life 2 if Life 1 vanished, Life 3 wild card). Each has a year-by-year timeline incl. non-career events, a **6-word title**, 2-3 **questions it tests**, and 4 gauges: **Resources, Likability, Confidence, Coherence** | Draft once, revisit quarterly | Candidate futures that feed prototypes |
| **Prototype conversations and experiences** | DYL [10] | Who to talk to or what to try, linked to an Odyssey question; notes on what you learned | Weekly | An evidence log for each Odyssey Plan |
| **Mind mapping** | DYL / Workbook [6] | Seed word → associations → combined concepts | Ad hoc, when stuck | New options / plans |
| **Reframes** (dysfunctional belief → reframe) | DYL [10] | A belief you hold and the reframed version | Ad hoc | A personal library of reframes |
| **Failure Log** | DYL worksheets [11] | Each failure tagged screw-up / weakness / growth opportunity, plus the insight | Weekly | A growth record |
| **Wonder / mini-flow / coherence check** | HTLAML [8][7] | Short daily notes: something wondrous you noticed, a mini-flow moment, whether today fit your Compass | Daily (seconds) | A meaning signal per day; feeds weekly review |
| **Formative community** | HTLAML [8] | The people and groups who help you grow; when you last saw them | Monthly | Prompts to connect |

The official site offers free worksheet PDFs: Good Time Journal, Energy-Engagement, Failure Log, Dashboard, and Odyssey Planning [11]. **There is no official app** [11][13].

## 3. What makes reflection and reminder apps stick

- **Most users stop early.** Across 93 well-being apps with ≥10k installs, median retention was 3.9% at day 15 and 3.3% at day 30. Tracker and peer-support apps retained better than the rest [14]. Plan for abandonment as the default outcome.
- **Push notifications help a little, and the effect fades.** A micro-randomised trial (n=1,255) found a tailored push raised the chance of engaging within 24 hours by only ~4%. The effect was larger at midday on weekends (exploratory finding) [15]. Each notification needs to earn its place.
- **Habits take months, and the spread is wide.** In Lally et al. (2010), the median time to automaticity was ~66 days (range 18-254). Missing a single day did not derail habit formation [16]. Don't punish broken streaks.
- **If-then plans work.** Implementation intentions ("when X, I will Y") have a medium-to-large effect on reaching goals, d≈0.65 across 94 tests [17]. The app should turn each day's intention into an if-then plan.
- **Doing a practice more often can backfire.** Counting blessings once a week raised well-being, but doing it three times a week did not [18]. Use a weekly cadence for heavier reflection and keep the daily step tiny.
- **Values affirmation:** Brief reflection on core values can buffer threat and support behaviour change. Effects depend on context and timing [19]. This supports showing the Compass at decision points rather than as constant wallpaper.
- **Expressive writing has a small effect on average** (r≈.075 across 146 RCTs) [20]. Don't oversell journaling as therapy.

## 4. Existing apps

| App | What it does | Gap vs a "Compass + daily alignment + Odyssey" app |
|---|---|---|
| Life Designer: Plan the Future (Intelligent Change) | iOS app "built on" Stanford design-thinking principles; unofficial [13] | Closest competitor. New, no ratings; feature depth unverified |
| Notion Odyssey templates | Static Odyssey Plan pages [13] | No daily loop, reminders or tracking of gauges over time |
| Day One | Journaling with templates, prompts, reminders | No Compass, gauges or plan model; reflection isn't linked to goals |
| Reflectly / Stoic | Guided morning/evening reflection, mood trends, streaks, prompts [21] | Mood-focused; no Odyssey or prototyping model; values not confirmed as a feature |
| Sunsama | Daily planning ritual, weekly objectives, shutdown and highlights [22] | Work-focused; no life direction or meaning layer |
| Todoist | Task manager with projects, priorities, karma | Has no way to explain why a task matters |
| Habitica | Habits turned into an RPG game | Rewards doing things, not meaning; extrinsic motivation |
| Rise (sleep/energy) | Plans the day around predicted energy peaks (unverified detail) | Measures physiological energy, not Good Time Journal-style engagement |
| Ikigai / values-card apps | One-off exercises to discover values | No daily follow-through |

**What nobody combines:** a written Compass, daily alignment against it, Odyssey Plans whose gauges change over time, and prototypes that feed back into those plans.

## 5. Implications for our app

**Cadence map**
- **Daily (≤60 s):** show one line of the Compass. Set the intention as an if-then plan and pick 1-3 tasks tied to an area or an Odyssey question. In the evening, rate engagement/energy and tick coherence (yes/no). Add an optional wonder note.
- **Weekly (10 min):** AEIOU review of the Good Time Journal, prototype log, Failure Log, next week's objectives (the Sunsama pattern).
- **Monthly / quarterly:** Health/Work/Play/Love Dashboard, re-score Odyssey gauges, check in with your community.
- **Yearly / life transitions:** rewrite Workview and Lifeview; redraft the Odyssey Plans.

**Riskiest assumptions**
1. **The daily reminder stays meaningful.** Repeated affirmations go stale [18], and pushes have small effects that fade [15]. Test this by varying the Compass line shown and measuring whether opening the app changes the plan for the day.
2. **The user will write the Compass and Odyssey Plans first.** The setup is heavy. Consider onboarding through the Good Time Journal (data first) and making the Odyssey Plans a week-2 ritual.
3. **Productivity tools crowd out meaning.** If the app becomes another Todoist, it loses its point. Keep tasks secondary to alignment.
4. **Odyssey Plans change often enough to track.** They are probably a quarterly artifact. Don't build daily UI around them.
5. **n=1 retention:** expect abandonment around weeks 2-4 [14][16]. Design a low-guilt way back (no streak shame, a "welcome back" weekly review).

## Sources

1. Santa Cruz Works, "Dave Evans and Bill Burnett's Newest Book 'How to Live a Meaningful Life'": https://www.santacruzworks.org/news/dave-evans-and-bill-burnett-howtoliveameaningfullife-book
2. Simon & Schuster book page (ISBN 9781668084892 / ebook 9781668084908): https://www.simonandschuster.com/books/How-to-Live-a-Meaningful-Life/Bill-Burnett/9781668084892
3. Designing Your Life official site (books, resources): https://designingyour.life/
4. Publishers Weekly, Designing Your Life (Knopf, 2016): https://www.publishersweekly.com/9781101875322
5. Wikipedia, Designing Your Life: https://en.wikipedia.org/wiki/Designing_Your_Life
6. Penguin Random House, The Designing Your Life Workbook: https://www.penguinrandomhouse.com/books/558132/the-designing-your-life-workbook-by-bill-burnett-and-dave-evans/9781524761813/
7. Goodreads, How to Live a Meaningful Life: https://www.goodreads.com/book/show/235992462-how-to-live-a-meaningful-life
8. Next Big Idea Club, "5 Design Principles for Feeling Fully Alive" (author-written BookBite): https://nextbigideaclub.com/magazine/5-design-principles-feeling-fully-alive-bookbite/58970/
9. StoryGraph reviews: https://beta.thestorygraph.com/book_reviews/b16b2480-5423-4f40-942c-87b64cdc3a0a
10. Burnett & Evans, *Designing Your Life* (Knopf, 2016), chapters 2-8 (Dashboard, Compass, Good Time Journal, Mind Mapping, Odyssey Plans, Prototyping, Reframes)
11. DYL worksheets and discussion questions: https://designingyour.life/worksheets-and-discussion-questions/
12. University of Florida Career Hub, Life Design Odyssey Plan Guide: https://careerhub.ufl.edu/resources/life-design-odyssey-plan-guide/
13. Life Designer app listing: https://appgoblin.info/apps/6757914192 ; Notion Odyssey template: https://simplicity-design.notion.site/Designing-Your-Life-Odyssey-Plans-Prototype-Your-Future-1f7ecb0e6d5e80da86e8d58a4cc92839
14. Baumel et al. (2019), JMIR 21(9):e14567: https://www.jmir.org/2019/9/e14567
15. Bidargaddi et al. (2018), JMIR mHealth uHealth 6(11):e10123: https://mhealth.jmir.org/2018/11/e10123
16. Lally et al. (2010), "How are habits formed," Eur J Soc Psychol 40(6):998-1009, doi:10.1002/ejsp.674
17. Gollwitzer & Sheeran (2006), Adv Exp Soc Psychol 38:69-119: https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes
18. Lyubomirsky, Sheldon & Schkade (2005), Rev Gen Psychol 9:111-131; APA Monitor summary: https://www.apa.org/monitor/oct06/key
19. Cohen & Sherman (2014), "The psychology of change: self-affirmation and social psychological intervention," Annu Rev Psychol 65:333-371, doi:10.1146/annurev-psych-010213-115137
20. Frattaroli (2006), Psychol Bull 132(6):823-865: https://pubmed.ncbi.nlm.nih.gov/17073523/
21. Stoic official site: https://www.getstoic.com/
22. Sunsama official site: https://www.sunsama.com/
