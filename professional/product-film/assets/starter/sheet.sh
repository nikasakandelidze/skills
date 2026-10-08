#!/bin/sh
# A contact sheet of stills, to check the picture by eye before (and after) a full render.
#   ./sheet.sh <name> <cols> <t0> <t1> <step>      e.g. ./sheet.sh act1 4 0 12 1   →  $TMPDIR/sheet-act1.png
# Greys and soft edges in a sheet can be scaling artefacts: open the frame itself at full size before fixing anything.
set -e
cd "$(dirname "$0")"
name=$1; cols=$2; t0=$3; t1=$4; step=$5
dir="${TMPDIR:-/tmp}/sheet-$name"
rm -rf "$dir" && mkdir -p "$dir"
times=$(awk -v a="$t0" -v b="$t1" -v s="$step" 'BEGIN{for(t=a;t<=b+1e-9;t+=s) printf "%.2f ", t}')
node render.mjs still "$dir" $times > /dev/null
n=$(ls "$dir" | wc -l | tr -d ' ')
rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -loglevel error -pattern_type glob -i "$dir/t*.png" -vf "scale=640:-1,tile=${cols}x${rows}:padding=6:color=0xcc0000" -frames:v 1 "$dir.png"
echo "$dir.png ($n frames: $times)"
