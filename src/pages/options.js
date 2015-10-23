document.addEventListener('DOMContentLoaded', function () {
    // Apply saved settings
    chrome.storage.sync.get(null, function(items) {
        document.querySelector("#ckbShowBrowser").checked = items.showBrowser;
        document.querySelector("#ckbShowVideo").checked = items.showVideo;
        document.querySelector("#ckbShowText").checked = items.showText;
        document.querySelector("#ckbCaptureImage").checked = items.captureImage;

        if (!items.sensepathMode) {
            items.sensepathMode = 'capture';
        }
        var radios = document.querySelectorAll("input[type='radio']");
        for (var i = 0; i < radios.length; i++) {
        	radios[i].checked = radios[i].value === items.sensepathMode;
        };

        if (items.sensepathMode === 'analysis') {
            document.querySelector('#captureSettings').classList.add('hide');
            document.querySelector('#analysisSettings').classList.remove('hide');
        } else {
            document.querySelector('#captureSettings').classList.remove('hide');
            document.querySelector('#analysisSettings').classList.add('hide');
        }
    });

    // Save settings
    document.querySelector("#ckbShowBrowser").addEventListener('click', function() {
        chrome.storage.sync.set({ showBrowser: this.checked });
    });
    document.querySelector("#ckbShowVideo").addEventListener('click', function() {
        chrome.storage.sync.set({ showVideo: this.checked });
    });
    document.querySelector("#ckbShowText").addEventListener('click', function() {
        chrome.storage.sync.set({ showText: this.checked });
    });
    document.querySelector("#ckbCaptureImage").addEventListener('click', function() {
        chrome.storage.sync.set({ captureImage: this.checked });
    });

    var radios = document.querySelectorAll("input[type='radio']");
    for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('click', function() {
            chrome.storage.sync.set({ sensepathMode: this.value });

            if (this.value === 'analysis') {
                document.querySelector('#captureSettings').classList.add('hide');
                document.querySelector('#analysisSettings').classList.remove('hide');
            } else {
                document.querySelector('#captureSettings').classList.remove('hide');
                document.querySelector('#analysisSettings').classList.add('hide');
            }
        });
    }
});