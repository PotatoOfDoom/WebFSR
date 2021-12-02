# WebFSR
this is an attempt to bring AMDs FidelityFx Superresolution to the web for all kinds of images/movies using a chrome extension.
The concept unfortunately didn't work out thanks to googles strict CORS restrictions which make capturing videos/images in WebGL contexts impossible/unviable without using hooks or other hacks (like using a CORS proxy).
This project was inspired by microsofts xbox cloud streaming fsr implementation (clarity boost) which is unfortunately closed source and restricted the xbox cloud streaming site only.
The FSR implementation itself is pretty much finished and works quite well: it works by finding every image/video and replacing it with a html canvas with the FSRd image. This has big visual differences and is a lot better than the internal chrome/firefox scaler. In the case of videos it additionally adds a hook to process every frame during playback.

## How do I run this
add this folder as an unpacked extension in chrome and try to access some pages. Lots of them won't work thanks to CORS but I added a test page "test.html" with an image and video to compare the results to.

## Credits & Inspiration
AMD Fsr https://github.com/GPUOpen-Effects/FidelityFX-FSR
WebGL FSR Implementation https://www.shadertoy.com/view/stXSWB
Xbox Clarity Boost (FSR but they don't say it anywhere for some reason) https://news.xbox.com/en-us/2021/11/29/clarity-boost-with-xbox-cloud-gaming-on-edge-browser/
