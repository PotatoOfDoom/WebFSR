chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.videoCount) {
            chrome.action.setBadgeText({ text: request.videoCount.toString() });
        }
    }
);

chrome.tabs.onActivated.addListener(
    function (activeInfo) {
        chrome.tabs.sendMessage(activeInfo.tabId, { msg: "update" }, function (response) {
            chrome.action.setBadgeText({ text: response.videoCount.toString() });
        });
    }
);