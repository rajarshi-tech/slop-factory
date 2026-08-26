stuff to do:
make video and subtitle filename id.ext not title.ext

convertsubtitles npt convert subs on ytdlp options, directly download as srt, no need for conversion. remove en vvt conversion

filename error while saving,fix it so file is not found

add video cropping for short form

in pipeline add list checking, to see if unprocessed videos exist. if yes skip fetching new ones

discard vixdeos from list after rejection

add trend score normalisation

edit processed status after each process

add api option too for processing input

display video length as well

if subs dont exist (cc), extract audio, then use whisper to generate word level subs.

then either use whisper again for each clip or cut the previously generated subs