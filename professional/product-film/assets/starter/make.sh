#!/bin/sh
# The whole film: picture, sound, and the two together. The film is named after its folder.
#   ./make.sh          everything (a few minutes: run it in the background)
#   ./make.sh sound    only the sound again, over the picture already rendered
set -e
cd "$(dirname "$0")"
name=$(basename "$(pwd)")
node render.mjs events
node audio/score.mjs
[ "$1" = sound ] || node render.mjs video "$name.silent.mp4"
# mastered for the web: -15 LUFS, true peak under -1.5 dB (two passes: measure, then normalise linearly)
stats=$(ffmpeg -hide_banner -i audio/mix.wav -af loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
val() { echo "$stats" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -y -loglevel error -i "$name.silent.mp4" -i audio/mix.wav -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11:measured_I=$(val input_i):measured_TP=$(val input_tp):measured_LRA=$(val input_lra):measured_thresh=$(val input_thresh):offset=$(val target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart -shortest "$name.mp4"
echo "wrote $(pwd)/$name.mp4"
