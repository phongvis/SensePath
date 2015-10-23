$(function() {
    var video, data,
        stopTime, keepPlaying = false,
        numSecondsEarlier = 3;
    initVideo();
    handleVideoRequest();

    function initVideo() {
        video = document.querySelector("video");
        video.addEventListener('timeupdate', function() {
            var brushIndices = [];

            // Sync with transcript when playing
            for (var i = 0; i < data.length; i++) {
                if (data[i].end) {
                    if (data[i].start <= this.currentTime && data[i].end >= this.currentTime) {
                        brushIndices.push(i);
                    }
                } else {
                    if (data[i].start <= this.currentTime && data[i].start + 1 >= this.currentTime) {
                        brushIndices.push(i);
                        break;
                    }
                }
            }

            // Stop within its activity
            if (!keepPlaying && stopTime) {
                if (this.currentTime >= stopTime - 0.5) { // Stop a bit earlier so that the selected item still be selected
                    this.pause();
                }
            }

            chrome.runtime.sendMessage({ type: "playback", brushUpdate: brushIndices });
        });

        $("#ckbPlay").change(function() {
            keepPlaying = !this.checked;
        });
        $("#ckbEarly").change(function() {
            numSecondsEarlier = this.checked ? 5 : 0;
        });
    }

    function handleVideoRequest() {
        // Listen to change video time
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.type === "playback") {
                if (request.time) {
                    video.currentTime = request.time.start - numSecondsEarlier;
                    stopTime = request.time.end;
                    video.pause();
                    data.forEach(function(d) { d.selected = false; });
                } else if (request.source) {
                    video.src = request.source;
                }
            } else if (request.type === "text" && request.full) {
                data = request.data;
            }
        });
    }
});