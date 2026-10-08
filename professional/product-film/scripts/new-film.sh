#!/bin/sh
# Start a new film from the starter rig. The folder's name becomes the film's file name.
#   sh <this skill's folder>/scripts/new-film.sh output/<product>-<slug>
# Then: open scene.html to scrub, `node render.mjs eval "CHECK()"`, `./sheet.sh a 4 0 <DUR> 1`, `./make.sh`.
set -e
skill=$(cd "$(dirname "$0")/.." && pwd)
dest=$1
[ -n "$dest" ] || { echo "usage: new-film.sh <folder>"; exit 1; }
[ -e "$dest" ] && { echo "$dest already exists: pick a new folder (never build over an earlier film)"; exit 1; }
mkdir -p "$dest"
cp -R "$skill/assets/starter/." "$dest/"
mkdir -p "$dest/audio/vo"
cp "$skill/assets/PROMPT.template.md" "$dest/PROMPT.md"
chmod +x "$dest/make.sh" "$dest/sheet.sh"
echo "new film in $dest"
echo "  treatment: $dest/PROMPT.md   clock: timeline.js   picture: film.js (+ lib.js)   sound: audio/score.mjs"
