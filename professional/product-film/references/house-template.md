# The house file (`FILMS.md`)

Every product that gets films keeps one `FILMS.md` next to its films (for example `films/FILMS.md` or
`output/FILMS.md`). It is the memory between films: what the product looks like, who its character is, where its
truth lives, what the team has said about past cuts, and every film and idea already made. Read it before
ideating. Create it from this shape when it doesn't exist, and update it after every film and every round of
feedback. Keep it in the product's repository, not in this skill.

```markdown
# Films: <Product>

<One paragraph: what the product is, who the films are for (consumers, developers, buyers), where they are
posted, the URL for end cards, and the feeling the films should leave.>

## The look

- Palette: <paper, ink, greys; the one colour allowed and what it means, if any>
- Type: <what the person writes> / <what the product writes>; the font files (embedded as base64 in fonts.css)
- Components: <pages, cards, chips, buttons, the calendar or the chat: their outlines, radii, sizes>
- The logo and wordmark: <how they are drawn, so an ending can build them>

## The character

<Body, eyes, moods (eye shapes per mood), how it moves, how it speaks (a bubble? words on the page?), its real
repertoire in the product (emotes, morphs, habits), and the code files that define it.>

## The product's truth

| What | Where in the code |
|---|---|
| <feature> | <files> |

**Strings the films may use** (check them in the code before reusing, since products change): <exact strings>

## Feedback, in order

- **<date>, <film>:** <what was liked, what was rejected, in the user's words where possible>

## Ledger: films already made

| Folder | Length / voice | Idea (the governing device) | Camera grammar | Ending / end line | Verdict |
|---|---|---|---|---|---|
| | | | | | |

## Bank: ideas pitched but not built

<Names, one line each, so the next round of ideas doesn't re-pitch them unknowingly.>

## Lessons

<Rig tricks and bugs specific to this product's films (positions, components, timing quirks).>
```

## Filling it in for a new product

1. Read the product's UI code for the components, type and palette; take screenshots of the real screens if the
   app runs.
2. Find the character, or decide there isn't one (the cursor, the logo mark, or the camera can lead instead).
3. List the features the films are likely to show, with their files and exact strings.
4. Leave the ledger and the bank empty; the first film starts them.
