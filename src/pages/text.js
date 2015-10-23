$(function() {
    var fullData, data, table,
        format = 'nvivo';
    initTable();
    handleExport();

    function initTable() {
        // Listen to get data
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.type === "text" && request.value === "show") {
                data = request.data;
                redraw();
            }
        });

        // Instantiate vis
        table = sm.vis.table();

        // Update the vis
        var updateVis = function() {
            redraw();
        };

        // Run first time to build the vis
        updateVis();

        // Rebuild vis when the window is resized
        var id;
        $(window).resize(function() {
            clearTimeout(id);
            id = setTimeout(updateVis, 100);
        });

        function redraw() {
            if (data) {
                d3.select(".sm-table-container").datum(data).call(table);
                table.maxWidth($(".sm-table-container").width());
                table.maxHeight($("body").height() - 90);
            }
        }
    }

    function handleExport() {
        $("#btnExport").click(function() {
            chrome.runtime.sendMessage({ type: "text", value: "export" }, function(fullData) {
                var useData = data && data.length ? data : fullData;
                var rows = useData.map(function(d) {
                    // var s = [ "[" + d.value1 + "]", d.value2 ? ("[" + d.value2 + "]") : "", "(" + d.value3 + ") " + (d.value4 ? "{" + d.value4 + "}" : "") + d.value5 ];
                    var s = [ d.value1, "(" + d.value3 + ") " + (d.value4 ? "{" + d.value4 + "}" : "") + d.value5 ];
                    s[1] = s[1].replace("\n", "");
                    return s;
                });
                var transcript = d3.tsv.formatRows(rows);

                $("#btnExport").attr("download", "transcript.txt")
                    .attr("href", window.URL.createObjectURL(new Blob([transcript])));
            });
        });
    }
});