#!/usr/bin/env bash
# Muxes the narration and burned-in Arabic subtitles onto the Playwright capture.
# Usage: bash demo/build.sh <recorded.webm>
set -euo pipefail

SRC="${1:?pass the recorded webm}"
OUT="demo/out/elevation-pitch.mp4"

DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$SRC")
AUD=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 demo/vo-final.wav)
echo "video ${DUR}s · audio ${AUD}s"

# Fit the capture to the narration length, then burn the Arabic track.
ffmpeg -y -v error \
  -i "$SRC" -i demo/vo-final.wav \
  -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,setpts=PTS*($AUD/$DUR)[v];[v]subtitles='demo/ar.srt':fontsdir='demo/fonts':force_style='FontName=Arial,FontSize=25,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=36'[vs]" \
  -map "[vs]" -map 1:a \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 \
  -c:a aac -b:a 192k -t "$AUD" \
  "$OUT"

ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
