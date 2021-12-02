function getAllVideoTags() {
    return document.getElementsByTagName("video");
}

function getAllImageTags() {
    return document.getElementsByTagName("img");
}

function getAllCanvasTags() {
    return document.getElementsByTagName("canvas");
}

function getVideoResolution(htmlVideo) {
    let width = htmlVideo.videoWidth;
    let height = htmlVideo.videoHeight;

    return { width, height };
}

function getClientResolution(htmlElement) {
    let scale = window.devicePixelRatio;
    let width = htmlElement.clientWidth * scale;
    let height = htmlElement.clientHeight * scale;

    return { width, height };
}

function isVideoResolutionSmallerThanViewport(videoElement) {
    let videoResolution = getVideoResolution(videoElement);
    let clientResolution = getClientResolution(videoElement);

    return videoResolution.width < clientResolution.width || videoResolution.height < clientResolution.height;
}

let videoTags = Array.from(getAllVideoTags());
let imgTags = Array.from(getAllImageTags());

function hookVideoOnLoad(htmlVideo) {
    htmlVideo.addEventListener('loadeddata', function () {
        const vidFilter = new ImageShader();
        htmlVideo.after(vidFilter.canvas);
        htmlVideo.crossorigin = 'anonymous';

        vidFilter.canvas.height = htmlVideo.height;
        vidFilter.canvas.width = htmlVideo.width;

        vidFilter.className = htmlVideo.className;

        //htmlVideo.style.display = "none";

        //do video element processing
        if (isVideoResolutionSmallerThanViewport(htmlVideo)) {
            //apply easu

        }

        const draw = () => {
            if(htmlVideo.paused)
                return;
            requestAnimationFrame(draw);
        
                vidFilter.setImage(htmlVideo);
                vidFilter.render();
        }

        htmlVideo.addEventListener('play', function() {
            draw();
        });

        //apply rcas
    });
}

function hookImgTag(imgTag) {
    const imgFilter = new ImageShader();
    imgFilter.setImage(imgTag);
    imgFilter.render();
    //imgTag.src = filteredImage.toDataURL();
    //replacing is somehow faster
    //imgFilter.canvas.className = imgTag.className;
    //imgTag.replaceWith(imgFilter.canvas);
    imgTag.src = imgFilter.canvas.toDataURL();
    imgFilter.destroy();
}

function hookAllVideoTags() {
    videoTags.forEach(videoTag => {
        hookVideoOnLoad(videoTag);
    });
}

function hookAllImgTags() {
    imgTags.forEach(imgTag => {
        hookImgTag(imgTag);
    });
}

function hookAllTags() {
    //hookAllVideoTags();
    hookAllImgTags();
}

hookAllTags();

const observer = new MutationObserver(function (mutationsList, observer) {
    for (let mutation of mutationsList) {
        for (let addedNode of mutation.addedNodes) {
            switch (addedNode.nodeName) {
                case "video":
                    break;
                case "img":
                    break;
                case "canvas":
                    break;
                default:
                    break;
            }
        }
    }
});

observer.observe(document, { childList: true, subtree: true });

function printAllVideoTagsWithRes() {
    let videoTags = getAllVideoTags();
}

chrome.runtime.sendMessage({ videoCount: videoTags.length });

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.msg) {
            case "update":
                sendResponse({ videoCount: videoTags.length });
                break;
        }
    }
)