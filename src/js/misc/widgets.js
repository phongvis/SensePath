/**
 * Shows a modal dialog.
 */
sm.modal = function(head, body, draggable, x, y) {
    var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
    var content = dialog.append("div").attr("class", "modal-dialog modal-lg")
        .append("div").attr("class", "modal-content");

    var header = content.append("div").attr("class", "modal-header");
    header.append("button").attr("class", "close").attr("data-dismiss", "modal").html("&times;");
    header.append("h4").attr("class", "modal-title").html(head);

    content.append("div").attr("class", "modal-body").append("div").html(body);

    $(dialog.node()).modal();

    if (draggable) {
        dialog = dialog.node();
        $(dialog).draggable({ handle: ".modal-header" }); // Need jquery-ui
        $(dialog).find(".modal-backdrop").css("display", "none");

        if (x !== undefined && y !== undefined) {
            $(dialog).css({
                left: x,
                top: y,
                bottom: "auto",
                right: "auto"
            });
        }
    }
};

/**
 * Shows quick view of the given url.
 */
sm.quickView = function(url) {
    var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
    var content = dialog.append("div").attr("class", "modal-dialog modal-lg")
        .append("div").attr("class", "modal-content");

    content.append("div").attr("class", "modal-body").style("height", "90%").append("iframe")
        .attr("width", "100%")
        .attr("height", "90%")
        .attr("src", url);

    $(dialog.node()).modal();
};

/**
 * Shows provenance capture dialog
 */
sm.showCaptureDialog = function(info, callback) {
    var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
    var content = dialog.append("div").attr("class", "modal-dialog modal-lg")
        .append("div").attr("class", "modal-content");

    var header = content.append("div").attr("class", "modal-header");
    header.append("button").attr("class", "close").attr("data-dismiss", "modal").html("&times;");
    header.append("h4").attr("class", "modal-title").html(info.title);

    var body = content.append("div").attr("class", "modal-body").append("div");
    body.append("img").attr("class", "img-responsive").style("max-height", $("body").height() * 0.8 + "px").attr("src", info.imgSrc);
    body.append("textarea").attr("rows", 4).style("width", "100%").style("margin-top", "20px").attr("class", "form-control").attr("placeholder", "Enter your note");

    var footer = content.append("div").attr("class", "modal-footer");
    footer.append("button").attr("class", "btn btn-primary").text("Submit")
        .on("click", function() {
            if (callback) {
                callback(body.select("textarea").node().value);
            }
            $(dialog.node()).modal("hide");
        });
    footer.append("button").attr("class", "btn btn-default").text("Cancel")
        .on("click", function() {
            $(dialog.node()).modal("hide");
        });

    $(dialog.node()).modal().on('shown.bs.modal', function() {
        $(this).find("textarea").focus();
    });
};

/**
 * Shows a dialog with a text input or textarea.
 */
sm.showTextDialog = function(info, isInput, callback) {
    var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
    var content = dialog.append("div").attr("class", "modal-dialog modal-sm")
        .append("div").attr("class", "modal-content");

    if (info.title) {
        var header = content.append("div").attr("class", "modal-header");
        header.append("button").attr("class", "close").attr("data-dismiss", "modal").html("&times;");
        header.append("h4").attr("class", "modal-title").html(info.title);
    }

    var body = content.append("div").attr("class", "modal-body").style("padding-top", "0").append("div");
    var input = body.append(isInput ? "input" : "textarea").attr("class", "form-control input")
        .attr("rows", 3)
        .attr("placeholder", "Enter your text")
        .style("width", "100%")
        .style("margin-top", "15px")
        .on("keydown", function () {
            if (d3.event.keyCode === 13) {
                onSave();
            }
        });
    $(input.node()).val(info.value);

    var onSave = function() {
        if (callback) {
            callback(body.select(".input").node().value);
        }
        onClose();
    };

    var onClose = function() {
        $(dialog.node()).modal("hide");
    };

    var footer = content.append("div").attr("class", "modal-footer");
    footer.append("button").attr("class", "btn btn-primary").text("Save")
        .on("click", onSave);
    footer.append("button").attr("class", "btn btn-default").text("Cancel")
        .on("click", onClose);

    $(dialog.node()).modal().on('shown.bs.modal', function() {
        $(this).find(".input").select();
    });
};