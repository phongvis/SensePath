$(function() {
    // Data
    var pendingTasks = {}, // For jumping to a note
        data = [];

    var sensepath,
        lastActiveItem,
        lastUrl,
        lastSearchAction,
        startRecordingTime,
        timeoutId, // To prevent redraw multiple times
        ignoredUrls = [ "chrome://", "chrome-extension://", "chrome-devtools://", "view-source:", "google.co.uk/url", "google.com/url" ],
        getGoogleLocation = function(url, pathname) {
            var trimUrl = url.pathname.substr(pathname.length + 1);
            return decodeURIComponent(trimUrl.substr(0, trimUrl.indexOf("/"))).replace(/\+/g, ' ');
        }, getOSMLocation = function(url) {
            // https://www.openstreetmap.org/search?query=london#map=12/51.5485/-0.2123
            var q = sm.getQueryStringFromSearch(url.search);
            return q ? q['query'] : q;
        }, getGoogleDirection = function(url, pathname) {
            // https://www.google.co.uk/maps/dir/The+World+Bank,+1818+H+Street+Northwest,+Washington,+DC+20433,+United+States/1914+Connecticut+Ave+NW,+Washington,+DC+20009,+USA/@38.9078884,-77.052622,15z/data=!4m14!4m13!1m5!1m1!1s0x89b7b7b0d7ea2d85:0x7c0ffdf15a217ec5!2m2!1d-77.042488!2d38.898932!1m5!1m1!1s0x89b7b7cfbe539997:0xf50e91ad60a7f906!2m2!1d-77.0464992!2d38.9162252!3e0
            var trimUrl = url.pathname.substr(pathname.length + 1);
            var index = trimUrl.indexOf("/");
            var fromUrl = trimUrl.substr(0, index);
            var toUrl = trimUrl.substr(index + 1);
            toUrl = toUrl.substr(0, toUrl.indexOf("/"));
            var from = decodeURIComponent(fromUrl).replace(/\+/g, ' ');
            var to = decodeURIComponent(toUrl).replace(/\+/g, ' ');
            return !from || !to ? "___one end empty___" : from + " to " + to;
        },
        keywordSearchTemplates = [
            {
                hostname: "www.google.",
                pathnames: [ "/", "/webhp", "/search", "/url" ],
                reg: /\Wq=([\w%+]*)/i
            }, {
                hostname: "www.bing.",
                pathnames: [ "/search" ],
                reg: /\Wq=([\w%+]*)/i
            }, {
                hostname: "search.yahoo.",
                pathnames: [ "/search" ],
                reg: /\Wp=([\w%+]*)/i
            }, {
                hostname: "ask.",
                pathnames: [ "/web" ],
                reg: /\Wq=([\w%+]*)/i
            }, {
                hostname: "duckduckgo.",
                pathnames: [ "/" ],
                reg: /\Wq=([\w%+]*)/i
            }, { // https://www.facebook.com/search/str/visualization/keywords_top
                hostname: "www.facebook.",
                pathnames: [ "/search/str" ],
                labelFunc: getGoogleLocation
            }, { // https://twitter.com/search?q=visualization&src=typd
                hostname: "twitter.",
                pathnames: [ "/search" ],
                reg: /\Wq=([\w%+]*)/i
            }, { // http://www.amazon.com/s/ref=nb_sb_noss_1?url=search-alias%3Daps&field-keywords=visualization
                hostname: "www.amazon.",
                pathnames: [ "/s" ],
                reg: /\Wfield-keywords=([\w%+]*)/i
            }, { // http://www.ebay.co.uk/sch/i.html?_from=R40&_trksid=p2050601.m570.l1313.TR0.TRC0.H0.Xvisualization.TRS0&_nkw=visualization&_sacat=0
                hostname: "www.ebay.",
                pathnames: [ "/sch"],
                reg: /\W_nkw=([\w%+]*)/i
            }, {
                hostname: "www.booking.",
                pathnames: [ "/"],
                reg: /\Wss=([\w%+]*)/i
            }, {
                hostname: "www.expedia.",
                pathnames: [ "/"],
                reg: /\Wdestination=([\w%+]*)/i
            }
        ],
        locationSearchTemplates = [
            {
                hostname: 'www.google.',
                pathname: '/maps/search',
                labelFunc: getGoogleLocation
            },
            {
                hostname: 'www.google.',
                pathname: '/maps/place',
                labelFunc: getGoogleLocation
            },
            {
                hostname: 'www.openstreetmap.',
                pathname: '/search',
                labelFunc: getOSMLocation
            }
        ],
        dirSearchTemplates = [
            {
                hostname: 'www.google.',
                pathname: '/maps/dir',
                labelFunc: getGoogleDirection
            }
        ],
        timeFormat = d3.time.format("%Y-%m-%d_%H-%M-%S"),
        followByBrowseActions = [ "search", "location", "place", "dir", "revisit", "link", "type", "bookmark", "unknown" ];
        visitedPages = {}, // Stores whether a page is visited
        tabRelationshipTypes = {}, // Stores how a tab is opened (revisit/link/type/bookmark)
        visitIdToItemIdLookup = {}, // Stores the mapping from visit id (history) to id of data item
        captureMode = false,
        showBrowser = true,
        showVideo = true,
        showText = true,
        captureImage = false,
        showBrowser = true,
        listening = false, // It's true when in capturing mode and capture is started
        mode = 'analysis';

    // For quick test/analysis: preload data to save time loading files in the interface
    var name, // Set to one of the participants below
        participants = {
            p1: { data: "data/p1/data.json", video: "data/p1/video.mp4" },
            p2: { data: "data/p2/data.json", video: "data/p2/video.mp4" },
            smp1: { data: "data/sm-p1/data-coded.json" },
            smp2: { data: "data/sm-p2/data-coded.json" }
        };

    var main = function() {
        buildVis();
        updateVis();
        schedulePageReadingUpdate();
        wheelHorizontalScroll();
    };

    // Capture sensemaking actions
    respondToContentScript();
    respondToTabActivated();
    respondToTabUpdated();

    // Read options from saved settings
    chrome.storage.sync.get(null, function(items) {
        showBrowser = items.showBrowser;
        showVideo = items.showVideo;
        showText = items.showText;
        captureMode = items.sensepathMode === 'capture' || !items.sensepathMode;
        captureImage = items.captureImage;

        if (showVideo) {
            respondToVideoChanged();
        }
        if (showText) {
            respondToTranscriptExported();
        }

        if (!captureMode && name) {
            // Load data
            d3.json(participants[name].data, function(json) {
                loadDataFile(json);
                main();
            });
            // Load video
            chrome.runtime.sendMessage({ type: "playback", source: participants[name].video });
        } else {
            main();
        }
    });

    function loadDataFile(json) {
        startRecordingTime = new Date(json.startRecordingTime);
        if (sensepath) sensepath.startRecordingTime(startRecordingTime);

        data = json.data;
        // Acually, shouldn't save them in the first place
        data.forEach(function(d) {
            delete d.transcript;
            delete d.customTranscript;
            delete d.zoomLevel;
        });
    }

    function respondToContentScript() {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (!listening) return;

            var tab = sender.tab;

            if (request.type === "dataRequested" || request.type === "taskRequested") { // No data change, no redraw
                if (request.type === "dataRequested") {
                    // Get highlights, notes for the requested item
                    var tabData = data.filter(function(d) { return d.url === tab.url; });
                    var t = tabData.map(function(d) { return shallowClone(d); });
                    sendResponse(t);
                } else if (request.type === "taskRequested") {
                    if (pendingTasks[tab.id]) {
                        var t = shallowClone(pendingTasks[tab.id]);
                        sendResponse(t);
                        delete pendingTasks[tab.id];
                    }
                }
            } else { // Data change, redraw group
                if (request.type === "highlighted" || request.type === "noted") {
                    var item, itemIndex;
                    if (request.type === "highlighted") {
                        var id = +new Date();
                        item = createNewItem(tab);
                        item.path = request.data.path;
                        item.classId = request.data.classId;
                        item.type = "highlight";
                    } else {
                        itemIndex = getItemIndex(tab.url, "classId", request.data.classId);
                        item = createNewItem(tab);
                        item.path = data[itemIndex].path;
                        item.classId = request.data.classId;
                        item.type = "note";
                    }

                    item.text = request.data.text;

                    // Somehow capturing screenshot happens before highlight + window closed, wait a bit to capture highlighted text
                    setTimeout(function() {
                        chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, function(dataUrl) {
                            if (captureImage) item.image = dataUrl;
                            // TODO: something wrong here, why added twice
                            // var newItem = clone(item);
                            // if (newItem.type === "note") newItem.id = +new Date();
                            // data.push(newItem);
                            redraw(true);
                        });
                    }, 100);
                } else if (request.type === "highlightRemoved") {
                    var itemIndex = getItemIndex(tab.url, "classId", request.classId);
                    var item = data[itemIndex];
                    data.splice(itemIndex, 1);
                    addChange({ id: +new Date(), action: item.type === "highlight" ? "remove-highlight" : "remove-note", index: itemIndex }, false);
                    redraw(true);
                }
            }
        });
    }

    function isBrowsingType(type) {
        return followByBrowseActions.indexOf(type) !== -1;
    }

    function createNewItem(tab) {
        var item = { time: new Date(), url: tab.url, text: tab.title, favIconUrl: tab.favIconUrl };
        item.id = +item.time;
        data.push(item);

        return item;
    }

    function getItemIndex(value1, name2, value2) {
        for (var i = 0; i < data.length; i++) {
            if (removeHash(data[i].url) === removeHash(value1) && (!name2 || data[i][name2] === value2)) {
                return i;
            }
        }

        return -1;
    }

    function removeHash(_url) {
        var url;
        try {
            url = new URL(_url);
        } finally {
            return url ? url.origin + url.pathname : _url;
        }
    }

    function isTabIgnored(tab) {
        return ignoredUrls.some(function(url) { return tab.url.indexOf(url) !== -1; });
    }

    function respondToTabActivated() {
        chrome.tabs.onActivated.addListener(function(activeInfo) {
            if (!listening) return;

        	chrome.tabs.query({ windowId: activeInfo.windowId, active: true }, function(tabs) {
                if (!tabs.length) return;

                var tab = tabs[0];
        		if (tab.status !== "complete" || isTabIgnored(tab)) return;

                // When a tab is activated, add a new item
                //  if the page has been opened before, set it as 'revisit'
                //  if not, set the page relationship as how it's opened (tabRelationshipTypes)
                if (visitedPages[removeHash(tab.url)]) {
                    addItem(tab, "revisit");
                } else {
                    addFirstTimeVisitPage(tab);
                    visitedPages[removeHash(tab.url)] = 1;
                }
            });
        });
    }

    /**
     * Checks and returns the type of action and its representing text (corresponding for each type: keyword/location/route/filtering).
     */
    function getSearchAction(tab) {
        // Checks in order and return the first one match: keyword - location - route - filtering
        return getKeywordSearch(tab) || getLocationSearch(tab) || getRouteSearch(tab);
    }

    /**
     * Checks and returns the searching keyword if applicable.
     */
    function getKeywordSearch(tab) {
        var url = new URL(tab.url);
        for (var i = 0; i < keywordSearchTemplates.length; i++) {
            var t = keywordSearchTemplates[i];
            if (url.hostname.indexOf(t.hostname) !== -1 && t.pathnames.some(function(d) { return url.pathname.indexOf(d) !== -1; })) {
                if (t.reg) {
                    var result = tab.url.match(t.reg);
                    return (!result || !result.length) ? null : { type: 'search', label: decodeURIComponent(result[result.length - 1]).replace(/\+/g, ' ') };
                } else {
                    var label = t.labelFunc(url, t.pathnames[0]);
                    if (label) return { type: 'search', label: label };
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Checks and returns the searching location if applicable.
     */
    function getLocationSearch(tab) {
        var url = new URL(tab.url);
        for (var i = 0; i < locationSearchTemplates.length; i++) {
            var t = locationSearchTemplates[i];
            if (url.hostname.indexOf(t.hostname) !== -1 && url.pathname.indexOf(t.pathname) !== -1) {
                var label = t.labelFunc(url, t.pathname);
                if (label) return { type: 'location', label: label };
                return null;
            }
        }

        return null;
    }

    /**
     * Checks and returns the searching route if applicable.
     */
    function getRouteSearch(tab) {
        var url = new URL(tab.url);
        for (var i = 0; i < dirSearchTemplates.length; i++) {
            var t = dirSearchTemplates[i];
            if (url.hostname.indexOf(t.hostname) !== -1 && url.pathname.indexOf(t.pathname) !== -1) {
                var label = t.labelFunc(url, t.pathname);
                if (label) return { type: 'dir', label: label };
                return null;
            }
        }

        return null;
    }

    function addFirstTimeVisitPage(tab) {
        var searchAction = getSearchAction(tab);
        var type = searchAction ? searchAction.type : tabRelationshipTypes[tab.url + "-" + tab.id];
        type = type || 'unknown';
        addItem(tab, type);
    }

    function addItem(tab, type) {
        if (!captureMode) return;

        setTimeout(function() {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, function(dataUrl) {
                if (!dataUrl) return;

                var searchAction = getSearchAction(tab);

                // Less than 0.5s, it must be some redirect, don't add it?
                var merged = lastActiveItem && (new Date() - lastActiveItem.time < 500);

                // In some search engines, pages reloaded when zoom and pan, causing multiple actions generated.
                // Need to detect and merge those actions into one. The last url is updated to the merged action.
                merged = merged || getLocationSearch(tab) && lastSearchAction && searchAction && searchAction.label === lastSearchAction.label;

                lastSearchAction = searchAction;

                if (searchAction && searchAction.label === "___one end empty___") return;



                var item = merged ? lastActiveItem : { time: new Date(), url: tab.url, text: searchAction ? searchAction.label : tab.title, type: type, favIconUrl: tab.favIconUrl };
                if (captureImage) item.image = dataUrl;
                if (!merged) item.id = +item.time;
                if (isBrowsingType(type)) item.endTime = new Date(+item.time + 1000);

                // Check if the current item having the same url but the params are different with the previous one.
                // If yes, a heuristic that the current item is from the same page with different params. Classify it as a filtering.
                if (lastActiveItem) {
                    var currentUrl = removeHash(tab.url);
                    var prevUrl = removeHash(lastActiveItem.url);
                    if (currentUrl === prevUrl) {
                        var filters = [];
                        var url = new URL(tab.url);
                        var currentParams = sm.getQueryStringFromSearch(url.search);
                        url = new URL(lastActiveItem.url);
                        var prevParams = sm.getQueryStringFromSearch(url.search);

                        // Three types: add, remove, update
                        if (!currentParams || !prevParams) return;

                        for (var key in currentParams) {
                            if (key in prevParams) {
                                if (prevParams[key] !== currentParams[key]) { // Update
                                    filters.push("update '" + key + "' from '" + decodeURIComponent(prevParams[key]) + "'' to '" + decodeURIComponent(currentParams[key]) + "'");
                                }
                            } else { // Add
                                filters.push("add '" + key + "' '" + decodeURIComponent(currentParams[key]) + "'");
                            }
                        }
                        for (var key in prevParams) {
                            if (!(key in currentParams)) { // Remove
                                filters.push("remove '" + key + "' '" + decodeURIComponent(prevParams[key]) + "'");
                            }
                        }

                        if (filters.length) {
                            item.type = 'filter';
                            item.text = filters.join('; ');
                        }
                    }
                }

                lastActiveItem = item;

                if (!merged) {
                    data.push(item);

                    // Record mapping visitId - itemId to update the provenance of 'link' relationship
                    chrome.history.getVisits({ url: tab.url }, function(results) {
                        if (!results || !results.length) return;

                        // The latest one contains information about the just completely loaded page
                        var visitItem = results[0];
                        visitIdToItemIdLookup[visitItem.visitId] = item.id;

                        if (item.type === 'link') {
                            item.from = visitIdToItemIdLookup[visitItem.referringVisitId];
                        }
                    });
                }

                redraw(true);
            });
        }, 500);
    }

    function respondToTabUpdated() {
        // When tab is already activated
        chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
            if (!listening) return;

            if (tab.status !== "complete" || isTabIgnored(tab)) return;

            // Record how to open this page. It doesn't need to be active.
            chrome.history.getVisits({ url: tab.url }, function(results) {
                if (!results || !results.length) return;

                // The latest one contains information about the just completely loaded page
                var visitItem = results[0];
                var bookmarkTypes = [ "auto_bookmark" ];
                var typedTypes = [ "typed", "generated", "keyword", "keyword_generated" ];

                if (bookmarkTypes.indexOf(visitItem.transition) !== -1) {
                    tabRelationshipTypes[tab.url + "-" + tab.id] = "bookmark";
                } else if (typedTypes.indexOf(visitItem.transition) !== -1) {
                    tabRelationshipTypes[tab.url + "-" + tab.id] = "type";
                } else {
                    tabRelationshipTypes[tab.url + "-" + tab.id] = "link";
                }

                if (tab.active) {
                    // Tab is active and completed. Snapshot can be captured.
                    visitedPages[removeHash(tab.url)] = 1;

                    if (lastUrl !== tab.url) { // Sometimes, add twice at same time? So, do an extra check.
                        addFirstTimeVisitPage(tab);
                        lastUrl = tab.url;
                    }
                }
            });
        });
    }

    function respondToVideoChanged() {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.type === "video-jump") {
                jumpTo(data[request.index]);
            } else if (request.type === "playback" && request.brushUpdate) {
                sensepath.updateBrush(request.brushUpdate);
            }
        });
    }

    function respondToTranscriptExported() {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.type === "text" && request.value === "export") {
                sendResponse(getTextViewData(data));
            }
        });
    }

    function getTextViewData(selection) {
        var timeFormat = d3.time.format("%H:%M:%S");
        var transcriptData = selection.map(function(d) {
            var t = d.transcript;

            return {
                id: d.id,
                value1: timeFormat(getRelativeTime(d.time)),
                value2: d.endTime ? timeFormat(getRelativeTime(d.endTime)) : null,
                value3: t.substring(t.indexOf("(") + 1, t.indexOf(")")),
                value4: d.theme || "",
                value5: t.substr((t.indexOf("}") !== -1 ? t.indexOf("}") : t.indexOf(")")) + 2),
                type: d.type,
                start: getRelativeTime(d.time) / 1000,
                end: d.endTime ? getRelativeTime(d.endTime) / 1000 : 0
            };
        });

        return transcriptData;
    }

    function buildVis() {
        sensepath = sm.vis.sensepath()
            .presentationMode(false)
            .on("itemClicked", jumpTo)
            .on("itemsSelected", function(d) {
                // Send data to text view
                chrome.runtime.sendMessage({ type: "text", value: "show", data: getTextViewData(d) });
            });

        if (name) {
            sensepath.startRecordingTime(startRecordingTime);
        }

        sensepath.scaleTime(!captureMode);

        // Register to update vis when the window is resized
        $(window).resize(function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateVis, 100);
        });

        // Show/Hide
        d3.select('#captureToolbar').classed('hide', !captureMode);
        d3.select('#loadToolbar').classed('hide', captureMode);
        // d3.select('.sm-provenance-container').classed('hide', captureMode);

        // Settings
        $("#btnSave").click(function() {
            var date = timeFormat(new Date());
            data.forEach(sensepath.cleanData);
            var saveData = { startRecordingTime: startRecordingTime, data: data };
            $(this).attr("download", date + "_provenance.json")
                .attr("href", URL.createObjectURL(new Blob([JSON.stringify(saveData)])));
        });

        $("#btnTmpLoadJson").change(function(e) {
            sm.readUploadedFile(e, function(content) {
                loadDataFile(JSON.parse(content));
                redraw(true);
            });
        });

        $("#btnTmpLoadVideo").change(function(e) {
            var fileURL = URL.createObjectURL(e.target.files[0]);
            chrome.runtime.sendMessage({ type: "playback", source: fileURL });
        });

        $("#btnRecord").click(function() {
            listening = true;
            d3.select("#btnRecord").classed('hide', listening);
            d3.select("#btnStop").classed('hide', !listening);

            startRecordingTime = new Date();
            sensepath.startRecordingTime(startRecordingTime);
            data = [];
            redraw(true);
        });

        $("#btnStop").click(function() {
            listening = false;
            d3.select("#btnRecord").classed('hide', listening);
            d3.select("#btnStop").classed('hide', !listening);
            $("#btnSave").get(0).click();
        });

        $("#btnLoadJson").click(function() {
            $("#btnTmpLoadJson").click();
        });
        $("#btnLoadVideo").click(function() {
            $("#btnTmpLoadVideo").click();
        });
    }

    function jumpTo(d) {
        if (showBrowser) {
            // Weird: query specific url returns empty array.
            chrome.tabs.query({}, function(tabs) {
                var windowId;
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].url === d.url) {
                        // Found it, tell content script to scroll to the element
                        chrome.tabs.update(tabs[i].id, { active: true });
                        chrome.tabs.sendMessage(tabs[i].id, { type: "scrollToElement", path: d.path, image: d.image });

                        // Get the tab/window in focused as well
                        chrome.windows.update(tabs[i].windowId, { focused: true });

                        return;
                    }
                }

                // Can't find it, already closed, open new item, request scrolling later on
                chrome.tabs.create({ url: d.url }, function(tab) {
                    chrome.windows.update(tab.windowId, { focused: true });
                    pendingTasks[tab.id] = d;
                });
            });
        }

        // Tell the video player to jump to that time
        if (showVideo) {
            chrome.runtime.sendMessage({ type: "playback", time: {
                start: getRelativeTime(d.time) / 1000,
                end: getRelativeTime(d.endTime ? d.endTime : d.parent ? d.parent.endTime : d.time) / 1000
            } });
        }
    }

    function getRelativeTime(t) {
        return new Date(new Date(t) - startRecordingTime);
    }

    function clone(d) {
         return $.extend(true, {}, d);
    }

    function shallowClone(d) {
        return { type: d.type, path: d.path, classId: d.classId, text: d.text, image: d.image };
    }

    function updateVis() {
        var margin = parseInt($(".sm-provenance-container").css("margin"));
        sensepath.width(window.innerWidth - margin * 2).height(window.innerHeight - margin * 2);

        redraw();
    }

    function redraw(dataChanged) {
        if (dataChanged) sensepath.dataChanged(true);
        d3.select(".sm-provenance-container").datum(data).call(sensepath);
    }

    function getDataById(id) {
        for (var i = 0; i < cloneData.length; i++) {
            if (cloneData[i].id === id) return cloneData[i];
        }
        return null;
    }

    function schedulePageReadingUpdate() {
        // After every a fix amount of seconds,
        // - gets the currently active tab in the browser
        // - updates reading time of the 'currently stored' active tab
        setInterval(function() {
            // Get active tab
            chrome.tabs.query({ active: true }, function(tabs) {
                var tab = tabs[0];
                if (!lastActiveItem || tab.status !== "complete" || isTabIgnored(tab)) return;

                var url = removeHash(tabs[0].url);
                if (getItemIndex(url) === -1) return; // The page still not captured

                if (isBrowsingType(lastActiveItem.type)) {
                    lastActiveItem.endTime = Math.max(lastActiveItem.endTime, new Date());
                }
            });
        }, 1000);
    }

    function wheelHorizontalScroll() {
        var leftMouseDown = false;
        var prevX;
        $("body").on("wheel", function(e) {
            this.scrollLeft -= e.originalEvent.wheelDelta;
            e.preventDefault();
        }).on("mousedown", function(e) {
            if (e.which === 1) {
                leftMouseDown = true;
                prevX = e.clientX;
            }
        }).on("mouseup", function(e) {
            leftMouseDown = false;
        }).on("mousemove", function(e) {
            if (leftMouseDown && e.shiftKey) {
                this.scrollLeft -= e.clientX - prevX;
                prevX = e.clientX;
                e.preventDefault();
            }
        });
    }
});