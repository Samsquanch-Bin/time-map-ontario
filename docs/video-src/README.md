# How-to video source

`docs/how-to-use-time-map-ontario.mp4` is an illustrated walkthrough (a drawn phone
mock-up following the app's real buttons and labels), not a screen recording.

Re-render (needs Node with Playwright and ffmpeg):

    node render.js 24
    ffmpeg -framerate 24 -i frames/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart ../how-to-use-time-map-ontario.mp4
