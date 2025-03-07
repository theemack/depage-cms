/*
 * @require framework/shared/jquery-1.12.3.min.js
 * @require framework/shared/jquery-sortable.js
 *
 * @require framework/shared/depage-jquery-plugins/depage-details.js
 * @require framework/shared/depage-jquery-plugins/depage-growl.js
 * @require framework/shared/depage-jquery-plugins/depage-live-filter.js
 * @require framework/shared/depage-jquery-plugins/depage-live-help.js
 * @require framework/shared/depage-jquery-plugins/depage-tooltip.js
 * @require framework/shared/depage-jquery-plugins/depage-shy-dialogue.js
 * @require framework/shared/depage-jquery-plugins/depage-uploader.js
 *
 * @require framework/HtmlForm/lib/js/lodash.custom.min.js
 * @require framework/HtmlForm/lib/js/effect.js
 * @require framework/Cms/js/xmldb.js
 * @require framework/Cms/js/locale.js
 * @require framework/Cms/js/depage.jstree.js
 * @require framework/Cms/js/spectrum.js
 *
 *
 * @file    js/global.js
 *
 * copyright (c) 2006-2018 Frank Hellenkamp [jonas@depage.net]
 *
 * @author    Frank Hellenkamp [jonas@depage.net]
 */

var depageCMS = (function() {
    "use strict";
    /*jslint browser: true*/
    /*global $:false */

    var lang = $('html').attr('lang');
    var locale = depageCMSlocale[lang];
    var baseUrl = $("base").attr("href");
    var projectName;
    var currentPreviewUrl,
        currentLoadedUrl,
        currentColorScheme,
        currentDocId,
        currentDocPropertyId,
        currentPreviewLang,
        currentLibPath = "",
        currentLibAccept = "",
        currentLibForceSize = "",
        currentTasksTimeout = null,
        currentTasks = {},
        previewStarted = 0,
        previewLoading = false,
        previewLoadTime = 0,
        previewUpdateTimer;
    var $html;
    var $window;
    var $body;
    var $previewFrame;
    var $toolbarLeft,
        $toolbarPreview,
        $toolbarRight;

    var mobileMediaQuery = window.matchMedia("(max-width: 765px)");

    var $pageTreeContainer,
        $pagedataTreeContainer,
        $docPropertiesContainer;

    var jstreePages,
        jstreePagedata,
        jstreeLibrary,
        jstreeColors;

    // various helper functions
    // {{{ $.scrollParent
    jQuery.fn.scrollParent = function() {
        var position = this.css( "position" ),
        excludeStaticParent = position === "absolute",
        scrollParent = this.parents().filter( function() {
            var parent = $( this );
            if ( excludeStaticParent && parent.css( "position" ) === "static" ) {
            return false;
            }
            return (/(auto|scroll)/).test( parent.css( "overflow" ) + parent.css( "overflow-y" ) + parent.css( "overflow-x" ) );
        }).eq( 0 );

        return position === "fixed" || !scrollParent.length ? $( this[ 0 ].ownerDocument || document ) : scrollParent;
    };
    // }}}
    // {{{ requestAnimationFrame()
    (function( window, Date ) {
        // feature testing
        var raf = window.requestAnimationFrame     ||
                window.mozRequestAnimationFrame    ||
                window.webkitRequestAnimationFrame ||
                window.msRequestAnimationFrame     ||
                window.oRequestAnimationFrame;

        window.animLoop = function(render) {
            var running, lastFrame = +(new Date());
            function loop( now ) {
                if (running !== false) {
                    raf ?
                        raf(loop) :
                        // fallback to setTimeout
                        setTimeout(loop, 16);

                    // Make sure to use a valid time, since:
                    // - Chrome 10 doesn't return it at all
                    // - setTimeout returns the actual timeout
                    now = +(new Date());
                    var deltaT = now - lastFrame;

                    // do not render frame when deltaT is too high
                    if (deltaT < 160) {
                        running = render(deltaT, now);
                    }
                    lastFrame = now;
                }
            }
            loop();
        };
    })(window, Date);
    // }}}
    // {{{ lerp()
    function lerp(min, max, fraction) {
        return (max - min) * fraction + min;
    }
    // }}}
    // {{{ copyToClipboard()
    function copyToClipboard(text) {
        if (typeof navigator.clipboard !== 'undefined') {
            // Clipboard API
            navigator.clipboard.writeText(text);
        } else if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);
        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy");  // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }
    // }}}
    // {{{ escapeRegExp
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    // }}}

    // local Project instance that holds all variables and function
    var localJS = {
        // {{{ ready
        ready: function() {
            $window = $(window);

            $html = $("html");
            $html.addClass("javascript");
            $body = $("body").addClass("layout-root");
            $previewFrame = $("#previewFrame");

            localJS.setup();

            // setup global events
            $window.on("statechangecomplete", localJS.setup);
            $body.on("switchLayout", localJS.switchLayout);

            mobileMediaQuery.addEventListener('change', localJS.onMobileSwitch);
            localJS.onMobileSwitch(mobileMediaQuery);

            // setup ajax timers
            setTimeout(localJS.updateAjaxContent, 1000);
        },
        // }}}
        // {{{ setup
        setup: function() {
            var matches = window.location.href.match(/project\/([^\/]*)\/.*/);
            if (matches !== null)  {
                projectName = matches[1];
            }

            localJS.setupVarious();
            localJS.setupLoginCheck();
            localJS.setupToolbar();
            localJS.setupPreviewLinks();
            localJS.setupTooltips();
            localJS.setupProjectList();
            localJS.setupUserList();
            localJS.setupNewsletterList();
            localJS.setupNewsletterPublish();
            localJS.setupSortables();
            localJS.setupForms();
            localJS.setupHelp();
            localJS.setupTrees();
            localJS.setupLibrary();
            localJS.setupColorSchemes();
            localJS.setupDropTargets();
            localJS.setupNotifications();
        },
        // }}}
        // {{{ setupAjaxContent
        setupAjaxContent: function() {
            localJS.setupPreviewLinks();
            localJS.setupTooltips();
            localJS.setupNewsletterList();
        },
        // }}}
        // {{{ setupVarious
        setupVarious: function() {
            $("#logout").click( function() {
                localJS.logout();

                return false;
            });

            // add click event for teaser
            $(".teaser").click( function() {
                document.location = $("a", this)[0].href;
            });
            $(document).on("context_show.vakata show.shydialogue", function(e) {
                if (mobileMediaQuery.matches) {
                    $("<div id=\"depage-live-help\"></div>").appendTo("body").addClass("visible");
                }
            });
            $(document).on("context_hide.vakata hide.shydialogue", function(e) {
                if (mobileMediaQuery.matches) {
                    $("#depage-live-help").remove();
                }
            });
        },
        // }}}
        // {{{ setupLoginCheck
        setupLoginCheck: function() {
            var checkTime = 10000;
            var lastTime = (new Date()).getTime();
            var $input = $("#login-formCsrfToken");

            setInterval(function() {
                // renew csrfToken of login form for long open pages
                $input.each(function() {
                    $.get(window.location + "?ajax=true", function(data) {
                        var $new = $($.parseHTML(data)).find("#login-formCsrfToken");

                        if ($new.length == 1) {
                            $input.attr("value", $new.attr("value"));
                        }
                    });
                });

                var currentTime = (new Date()).getTime();
                if (currentTime > (lastTime + checkTime * 2)) {  // ignore small delays
                    // Probably just woke up!
                    setTimeout(localJS.wakeFromSleep, 100);
                }
                lastTime = currentTime;

                // we already show a login box
                if ($input.length > 0) return;

                // check if user is logged in
                $.ajax({
                    async: true,
                    type: 'GET',
                    url: baseUrl + "api/-/user/status/",
                    success: function(data, status) {
                        if (status == 'success' && !data.loggedin) {
                            var unprotectedUrls = [
                                'login',
                                'logout'
                            ];
                            var action = window.location.toString().match(new RegExp(escapeRegExp(baseUrl) + "([^/]*)(/.*)?"));
                            if (unprotectedUrls.indexOf(action[1]) == -1) {
                                window.location = baseUrl + "login/?loggedOut&redirectTo=" + encodeURIComponent(window.location);
                            }
                        }
                    }
                });

            }, checkTime);
        },
        // }}}
        // {{{ setupNotifications
        setupNotifications: function() {
            if (!window.WebSocket) {
                return;

            }

            var ws = null;
            var webSocketUrl = baseUrl.replace(/^(http)/, "ws") + "notifications";

            ws = new WebSocket(webSocketUrl);
            ws.onmessage = function(e) {
                try {
                    var data = JSON.parse(e.data);

                    if (data.type == "notification") {
                        localJS.handleNotifications(data);
                    } else {
                        localJS.handleTaskMessage(data);
                    }
                } catch (exeption) {
                    return true;
                }
            };
            ws.onerror = function(e) {
                console.log("websocket error");
                console.log(e);
            };
            ws.onclose = function() {
                setTimeout(function() {
                    localJS.setupNotifications();
                }, 1000);
            };
        },
        // }}}
        // {{{ setupToolbar
        setupToolbar: function() {
            $toolbarLeft = $("#toolbarmain > .toolbar > menu.left");
            $toolbarPreview = $("#toolbarmain > .toolbar > menu.preview");
            $toolbarRight = $("#toolbarmain > .toolbar > menu.right");
            var $toolbarLayout = $("<menu class=\"toolbar layout-buttons\" data-live-help=\"" + locale.layoutSwitchHelp + "\"></menu>").insertAfter("#toolbarmain");

            // add tree actions
            $toolbarLeft.append("<li class=\"tree-actions\"></li>");

            localJS.updateLayoutButtons($body);

            // add button placeholder
            var $previewButtons = $("<li class=\"preview-buttons\"></li>").prependTo($toolbarPreview);

            // add edit button
            var $editButton = $("<a class=\"button\" data-live-help=\"" + locale.editHelp + "\" data-tooltip=\"" + locale.editTooltip + "\">" + locale.edit + "</a>")
                .appendTo($previewButtons)
                .on("click", function() {
                    var url = "";
                    try {
                        url = $previewFrame[0].contentWindow.location.href;
                    } catch(error) {
                    }
                    var matches = url.match(/project\/([^\/]*)\/preview\/[^\/]*\/[^\/]*\/[^\/]*(\/.*)/);

                    if (matches) {
                        var project = matches[1];
                        var page = matches[2];

                        localJS.edit(project, page);
                    }
                });

            // add reload button
            var $reloadButton = $("<a class=\"button icon-reload icon-only\" data-live-help=\"" + locale.reloadHelp + "\" data-tooltip=\"" + locale.reloadTooltip + "\">" + locale.reload + "</a>")
                .appendTo($previewButtons)
                .on("click", function() {
                    if ($previewFrame.length > 0) {
                        $previewFrame[0].contentWindow.location.reload();
                    }
                });

            // add zoom select
            var zooms = [100, 75, 50];
            var $zoomMenu = $("<li class=\"zoom\"><a data-live-help=\"" + locale.zoomHelp + "\">" + zooms[0] + "%</a><menu class=\"popup\"></menu></li>").appendTo($toolbarPreview).find("menu");
            var $zoomMenuLabel = $zoomMenu.siblings("a");

            $(zooms).each(function() {
                var zoom = this;
                var $zoomButton = $("<li><a>" + zoom + "%</a></li>").appendTo($zoomMenu).find("a");
                $zoomButton.on("click", function() {
                    $("div.preview").removeClass("zoom100 zoom75 zoom50")
                        .addClass("zoom" + zoom);
                    $zoomMenuLabel.text(zoom + "%");
                });
            });

            // add live filter to projects menu
            $("menu .projects").depageLiveFilter("li", "a", {
                placeholder: locale.projectFilter,
                attachInputInside: true,
                onSelect: function($item) {
                    var $link = $item.find("a").first();
                    if ($link.click()) {
                        window.location = $link[0].href;
                    }
                }
            });

            // add menu navigation
            var $menus = $("#toolbarmain > .toolbar > menu > li");
            var menuOpen = false;

            $menus.each(function() {
                var $entry = $(this);
                var $sub = $entry.find("menu");

                if ($sub.length > 0) {
                    $entry.children("a").on("click", function(e) {
                        var $input = $entry.find("input");
                        if (!menuOpen) {
                            // open submenu if there is one
                            $menus.removeClass("open");
                            $entry.addClass("open");

                            $input.focus();
                        } else {
                            // close opened submenu
                            $menus.removeClass("open");
                            $input.blur();
                        }
                        menuOpen = !menuOpen;

                        return false;
                    });
                    $entry.children("a").on("mouseenter", function(e) {
                        // open submenu on hover if a menu is already open
                        if (menuOpen) {
                            $menus.removeClass("open");
                            $entry.addClass("open");
                        }
                    });
                    $sub.on("click", function(e) {
                        e.stopPropagation();
                    });
                    $sub.find("a").on("click", function(e) {
                        if (menuOpen) {
                            $menus.removeClass("open");
                            menuOpen = false;
                        }
                    });
                }
            });

            $html.on("click", function() {
                // close menu when clicking outside
                $menus.removeClass("open");
                menuOpen = false;
            });
        },
        // }}}
        // {{{ setupProjectList
        setupProjectList: function() {
            var $projects = $(".projectlist");
            var $projectGroups = $projects.children(".projectgroup");

            $projects.depageDetails();

            $projects.find(".buttons .button").on("click", function(e) {
                e.stopPropagation();
            });
            $projects.find(".buttons .button.shortcuts").on("click", function(e) {
                var projectName = $(this).parents("dt").data("project");

                $.vakata.context.show($(this), null, {
                    '_add-title': {
                        label: locale.createNew,
                        action: false,
                        _disabled: true,
                        separator_after: true
                    },
                    '_add-post': {
                        label: locale.newPost,
                        action: function() {
                            localJS.addNewPost(projectName);
                        }
                    }
                });
            });

            $projects.on("depage.detail-opened", function(e, $head, $detail) {
                var project = $head.data("project");
                var projectNewsletter = $head.data("project-newsletter");
                var changesUrl;

                if (project) {
                    changesUrl = baseUrl + "project/" + project + "/details/100/?ajax=true";
                } else if (projectNewsletter) {
                    changesUrl = baseUrl + "project/" + projectNewsletter + "/newsletters/?ajax=true";
                }

                if (changesUrl) {
                    $.get(changesUrl)
                        .done(function(data) {
                            $detail.empty().html(data);

                            localJS.setupAjaxContent();
                        });
                }
            });

            $projects.depageLiveFilter("dt", "strong", {
                placeholder: locale.projectFilter,
                autofocus: true
            });
            $projects.on("depage.filter-shown depage.filter-hidden", function(e, $item) {
                // show and hide headlines for project-groups
                $projectGroups.each(function() {
                    var $group = $(this);
                    var $headline = $group.children("h2");

                    if ($group.find("dt:visible").length > 0) {
                        $headline.show();
                    } else {
                        $headline.hide();
                    }
                });
            });
            $projects.on("depage.filter-hidden", function(e, $item) {
                // close details for hidden items
                $projects.data("depage.details").hideDetail($item);
            });
        },
        // }}}
        // {{{ setupUserList
        setupUserList: function() {
            $("table.users").depageLiveFilter("tbody tr", "td", {
                placeholder: locale.userFilter,
                autofocus: true
            });
        },
        // }}}
        // {{{ setupNewsletterList
        setupNewsletterList: function() {
            var $newsletters = $(".newsletter.recent-changes tr:has(td.url)").each(function() {
                var $row = $(this);
                var projectName = $row.data("project");
                var newsletterName = $row.data("newsletter");
                var xmldb = new DepageXmldb(baseUrl, projectName, newsletterName);

                var $deleteButton = $("<a class=\"button\">" + locale.delete + "</a>")
                    .appendTo($row.find(".buttons"))
                    .depageShyDialogue({
                        ok: {
                            title: locale.delete,
                            classes: 'default',
                            click: function(e) {
                                xmldb.deleteDocument();

                                // @todo remove only if operation was successful
                                $row.remove();

                                return true;
                            }
                        },
                        cancel: {
                            title: locale.cancel
                        }
                    },{
                        title: locale.delete,
                        message : locale.deleteQuestion,
                        actionActiveTimeout: 1000,
                        directionMarker: true
                    });
            });
        },
        // }}}
        // {{{ setupNewsletterPublish
        setupNewsletterPublish: function() {
            $(".depage-form.newsletter.publish").each(function() {
                var $form = $(this);
                var $submit = $form.find(".submit input")
                    .depageShyDialogue({
                        ok: {
                            title: locale.sendNow,
                            classes: 'default',
                            click: function(e) {
                                $form.submit();

                                return true;
                            }
                        },
                        cancel: {
                            title: locale.cancel
                        }
                    },{
                        title: locale.sendNow + "?",
                        message: function() {
                            var rec = $form.find(".recipients input:checked").parent().attr("title") || "";
                            return locale.sendConfirmQuestion + " '" + rec + "'";
                        },
                        actionActiveTimeout: 1000,
                        directionMarker: true
                    });
            });
        },
        // }}}
        // {{{ setupPreviewLinks
        setupPreviewLinks: function() {
            $("a.preview").on("click", function(e) {
                if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

                var currentLayout = $body.data("currentLayout");
                if (mobileMediaQuery.matches) {
                    $body.triggerHandler("switchLayout", "preview");
                } else if (currentLayout != "split" && currentLayout != "tree-split" && currentLayout != "preview") {
                    $body.triggerHandler("switchLayout", "split");
                }
                localJS.preview(this.href);

                return false;
            });
        },
        // }}}
        // {{{ setupSortables
        setupSortables: function() {
            $(".sortable-forms").each(function() {
                var currentPos, newPos;
                var $sortable = $(this);

                var $form = $sortable.find("form");
                var xmldb = new DepageXmldb(baseUrl, $form.attr("data-project"), $form.attr("data-document"));

                $sortable.find(".sortable").each( function() {
                    var $container = $(this);
                    var $head = $container.find("h1");

                    $head.on("click", function() {
                        if ($container.hasClass("active")) {
                            $container.removeClass("active");
                        } else {
                            $(".sortable.active").removeClass("active");
                            $container.addClass("active");
                        }
                    });

                    if (!$container.hasClass("new")) {
                        // @todo make last element undeletable
                        var $deleteButton = $("<a class=\"button delete\">" + locale.delete + "</a>");

                        $deleteButton.appendTo($container.find("p.submit"));
                        $deleteButton.depageShyDialogue({
                            ok: {
                                title: locale.delete,
                                classes: 'default',
                                click: function(e) {
                                    var $input = $container.find("p.node-name");

                                    xmldb.deleteNode($input.data("nodeid"));

                                    // @todo remove only if operation was successful
                                    $container.remove();

                                    return true;
                                }
                            },
                            cancel: {
                                title: locale.cancel
                            }
                        },{
                            title: locale.delete,
                            message : locale.deleteQuestion,
                            actionActiveTimeout: 1000,
                            directionMarker: true
                        });
                    }
                });
                $sortable.sortable({
                    itemSelector: ".sortable:not(.new)",
                    containerSelector: ".sortable-forms",
                    nested: false,
                    handle: "h1",
                    pullPlaceholder: false,
                    placeholder: '<div class="placeholder"></div>',
                    tolerance: 40,
                    onDragStart: function($item, container, _super, event) {
                        currentPos = $item.index();

                        _super($item, container);
                    },
                    onDrag: function ($item, position, _super, event) {
                        position.left = 5;
                        position.top -= 10;

                        $item.css(position);
                        $(".placeholder").text($item.find("h1").text());
                    },
                    onDrop: function($item, container, _super, event) {
                        var $input = $item.find("p.node-name");

                        xmldb.moveNode($input.data("nodeid"), $input.data("parentid"), newPos);

                        _super($item, container);
                    },
                    afterMove: function ($placeholder, container, $closestItemOrContainer) {
                        newPos = $placeholder.index();
                    }
                });
            });
        },
        // }}}
        // {{{ setupForms
        setupForms: function() {
            // clear password inputs on user edit page to reset autofill
            setTimeout(function() {
                $(".depage-form.edit-user input[type=password]").each(function() {
                    this.value = "";
                });
            }, 300);

            // add select-all button
            $("form fieldset.select-all").each(function() {
                var $boolean = $(this).find(".input-boolean");
                var $button = $("<p class=\"select-all\"><button>" + locale.selectAll + "</button></p>").insertAfter($(this).find("legend").next()).find("button");
                var allSelected = false;

                $button.on("click", function() {
                    if (!allSelected) {
                        $boolean.find("input").val(["true"]);
                        $button.html(locale.deselectAll);
                    } else {
                        $boolean.find("input").val(["false"]);
                        $button.html(locale.selectAll);
                    }

                    allSelected = !allSelected;

                    return false;
                });
            });

            $("fieldset.detail").depageDetails({
                head: "legend"
            });

            if (typeof Squire !== 'undefined') {
                // {{{ Squire.showLinkDialog()
                Squire.prototype.showLinkDialog = function(href, callback) {
                    var editor = this;
                    var pos = editor.getPosBySelection();

                    $body.depageShyDialogue({
                        ok: {
                            title: locale.ok,
                            classes: "default",
                            click: function(e) {
                                callback($("#depage-shy-dialogue input")[0].value);
                            }
                        },
                        cancel: {
                            title: locale.cancel,
                            click: function(e) {
                                editor.focus();
                            }
                        }
                    },{
                        bind_el: false,
                        direction: "TC",
                        directionMarker: true,
                        inputs: {
                            href: {
                                placeholder: 'http://domain.com',
                                classes: 'edit-href',
                                value: href
                            }
                        }
                    });

                    $body.data("depage.shyDialogue").showDialogue(pos.left, pos.top);
                };
                // }}}
            }
        },
        // }}}
        // {{{ setupHelp
        setupHelp: function() {
            $("#help").depageLivehelp({});
        },
        // }}}
        // {{{ setupTooltips
        setupTooltips: function() {
            $("*[data-tooltip]").each(function() {
                var $t = $(this);
                var dir = $t.attr("data-pos") || "BC";

                $t.depageTooltip({
                    direction: dir,
                    directionMarker: true,
                    positionOffset: 20,
                    message: function() {
                        return $t.attr("data-tooltip")
                    }
                });
            });
        },
        // }}}
        // {{{ setupTrees
        setupTrees: function() {
            $pageTreeContainer = $(".tree.pages");
            $pagedataTreeContainer = $(".tree.pagedata");
            $docPropertiesContainer = $(".doc-properties");

            localJS.loadPageTree();
            localJS.loadNewsletterTree();
        },
        // }}}
        // {{{ setupDropTargets
        setupDropTargets: function() {
            $(document)
                .on("dnd_move.vakata.jstree", function(e, data) {
                    var $target = $(data.event.target);
                    var $parent = $target.parent().parent();

                    if (($target.hasClass("edit-href") || $parent.hasClass("edit-href")) && data.element.href.indexOf("pageref://") === 0) {
                        $target.addClass("dnd-hover");
                    } else {
                        $("input.dnd-hover").removeClass("dnd-hover");
                    }
                })
                .on('dnd_stop.vakata.jstree', function (e, data) {
                    var $target = $(data.event.target);
                    var $parent = $target.parent().parent();

                    if (($target.hasClass("edit-href") || $parent.hasClass("edit-href")) && data.element.href.indexOf("pageref://") === 0) {
                        $target[0].value = data.element.href;
                        $target.removeClass("dnd-hover");
                        $target.trigger("change");
                    }
                });
        },
        // }}}
        // {{{ setupLibrary
        setupLibrary: function() {
            var $libraryTreeContainer = $(".tree.library .jstree-container");
            var $fileContainer = $(".files .file-list");
            var $toolbar = $("<span class=\"toolbar-filelist\"></span>").appendTo("#toolbarmain .tree-actions");
            var $deleteButton = localJS.addToolbarButton($toolbar, locale.delete, "icon-delete", localJS.deleteSelectedFiles);
            var last = false;

            jstreeLibrary = $libraryTreeContainer.depageTree()
                .on("activate_node.jstree", function(e, data) {
                    var path = data.node.a_attr.href.replace(/libref:\/\//, "");

                    if (currentLibPath != path) {
                        currentLibPath = path;

                        localJS.loadLibraryFiles(path);
                    }
                })
                .on("refresh.jstree", function() {
                    var selected = jstreeLibrary.get_selected(true);

                    if (typeof selected[0] == 'undefined') return;
                    var path = selected[0].a_attr.href.replace(/libref:\/\//, "");

                    if (currentLibPath != path) {
                        currentLibPath = path;

                        localJS.loadLibraryFiles(path);
                    }
                })
                .on("ready.jstree", function() {
                    $fileContainer.click();

                    if ($body.data("currentLayout") == "pages") {
                        jstreeLibrary.gainFocus();
                    }
                })
                .on("focus.jstree", function() {
                    $fileContainer.removeClass("focus");
                    $toolbar.removeClass("visible");
                })
                .jstree(true);

            $fileContainer
                .on("selectionChange.depage", function() {
                    localJS.checkSelectedFiles();

                    if ($fileContainer.find(".selected").length > 0) {
                        $deleteButton.removeClass("disabled");
                    } else {
                        $deleteButton.addClass("disabled");
                    }
                })
                .on("click", function(e) {
                    $fileContainer.addClass("focus");
                    $toolbar.addClass("visible");

                    jstreeLibrary.looseFocus();
                })
                .on("click", "figure", function(e) {
                    var $thumbs = $fileContainer.find("figure");
                    var current = $thumbs.index(this);

                    // allow multiple select with ctrl and shift
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                        $fileContainer.find(".selected").removeClass("selected");
                        last = false;
                    }
                    // allow multiple select in row with shift
                    if (e.shiftKey) {
                        if (last !== false) {
                            var start = last;
                            var end = current;
                            if (last > current) {
                                start = current;
                                end = last;
                            }
                            for (var i = start; i <= end; i++) {
                                $thumbs.eq(i).addClass("selected");
                            }
                        }
                    } else {
                        $(this).toggleClass("selected");
                    }
                    last = current;
                    $thumbs.blur();

                    $fileContainer.trigger("selectionChange.depage");
                })
                .on("contextmenu", "figure", function(e) {
                    var $thumb = $(this);
                    if (!$thumb.hasClass("selected")) {
                        $thumb.addClass("selected");
                        $fileContainer.trigger("selectionChange.depage");
                    }

                    $.vakata.context.show($(this), {x: e.pageX, y:e.pageY}, {
                        _chooseCenter: {
                            label: locale.chooseCenter,
                            action: function() {
                                localJS.chooseImageCenter($thumb);
                            }
                        },
                        _copyUrl: {
                            separator_before: true,
                            label: locale.copyUrl,
                            action: function() {
                                copyToClipboard($thumb.attr("data-url"));
                            }
                        },
                        _shareFile: {
                            label: locale.shareUrl,
                            _disabled: $thumb.hasClass("not-published"),
                            action: function() {
                                $('<iframe src="mailto:?subject=' + locale.shareUrlSubject + '&body=' + $thumb.attr("data-url") + '">').appendTo('body').css("display", "none");
                            }
                        },
                        _delete: {
                            separator_before: true,
                            label: locale.delete,
                            action: function() {
                                localJS.deleteSelectedFiles();
                            }
                        }
                    });

                    return false;
                })
                .on("dblclick", "figure", function(e) {
                    var $ok = $(".dialog-full .dialog-bar .button.default");
                    if ($ok.length == 1) {
                        $ok.click();
                    }
                });

            $(".open-search").on("click", function() {
                localJS.loadLibraryFiles("");
                currentLibPath = "";
                jstreeLibrary.deselect_all();

                if (mobileMediaQuery.matches) {
                    $(this).trigger("switchLayout", "properties");
                }
            });

            localJS.setupFileList();
        },
        // }}}
        // {{{ setupFileList
        setupFileList: function() {
            var $uploadForm = $(".upload-to-lib");
            var $searchForm = $(".search-lib").depageForm();
            var $dropArea = $uploadForm.parents('.file-list');
            var $progressArea = $("<div class=\"progressArea\"></div>").appendTo($uploadForm);
            var $fileContainer = $(".files .file-list");

            if ($uploadForm.length > 0) {
                $(document)
                    .off('dragover')
                    .off('dragend')
                    .off('drop');

                $uploadForm.find('p.submit').remove();
                $uploadForm.find('input[type="file"]').depageUploader({
                    $drop_area: $dropArea,
                    $progress_container: $progressArea
                }).on('complete', function() {
                    localJS.loadLibraryFiles($uploadForm.find("p.input-file").attr("data-path"));
                });
                $uploadForm.on("submit", function() {
                    return false;
                });
            }

            if ($searchForm.length > 0) {
                localJS.setupFileSearch($searchForm);
            }
            $(".search").toggleClass("active", $searchForm.length > 0);

            $fileContainer.trigger("selectionChange.depage");
        },
        // }}}
        // {{{ setupFileSearch
        setupFileSearch: function($form) {
            var query,
                lastQuery,
                loading = false,
                $queryInput = $form.find('.input-search input');

            var getQuery = function() {
                var q = "";
                $("input, select, textarea", $form).each(function() {
                    var type = $(this).attr("type");
                    if ((type == "search")) {
                        q += this.value;
                    } else if ((type == "radio")) {
                        if (this.checked) {
                            q += this.value;
                        }
                    }
                });

                return q;
            };
            var testForLoading = function() {
                query = getQuery();

                if (loading) {
                    setTimeout(testForLoading, 100);
                    return;
                }
                if (query == lastQuery) {
                    return;
                }

                loadResults();
            };
            var loadResults = function() {
                var url = baseUrl + "project/" + projectName + "/library/search/";
                var $fileContainer = $(".files .file-list ul.results");

                loading = true;
                $fileContainer.empty().load(url + "?ajax=true ul.results > *", function() {
                    lastQuery = query;
                    loading = false;
                });
            };
            var clearQuery = function() {
                $queryInput[0].value = '';
                $queryInput.change();
            }

            query = lastQuery = getQuery();

            $form.find('p.submit')
                .remove();
            $queryInput
                .select()
                .on("keydown", function(e) {
                    if (e.keyCode == 27) {
                        clearQuery();
                    }
                });
            $("<a class=\"clear\"></a>")
                .insertAfter($queryInput)
                .on('click', clearQuery);

            $form.on("depageForm.autosaved", function() {
                testForLoading();
            });
            $form.on("submit", function() {
                return false;
            });
        },
        // }}}
        // {{{ setupColorSchemes
        setupColorSchemes: function() {
            var $colorTreeContainer = $(".tree.colors .jstree-container");
            var $colorContainer = $(".colorscheme .color-list");
            var $colorProps = $(".color-property");

            var $toolbar = $("<span class=\"toolbar-colors\"></span>").appendTo("#toolbarmain .tree-actions");
            localJS.addToolbarButton($toolbar, locale.create, "icon-create", localJS.addColor);
            var $deleteButton = localJS.addToolbarButton($toolbar, locale.delete, "icon-delete", localJS.deleteSelectedColor);

            jstreeColors = $colorTreeContainer.depageTree()
                .on("activate_node.jstree", function(e, data) {
                    var nodeId = null;
                    if (typeof data.node.data !== 'undefined') {
                        nodeId = data.node.data.nodeId;
                    }
                    if (data.node.li_attr.rel != "proj:colorscheme") {
                        $colorContainer.empty();
                        $colorProps.empty();
                        return;
                    }

                    var url = baseUrl + "project/" + projectName + "/colors/edit/" + nodeId + "/";

                    $colorContainer.removeClass("loaded").load(url + "?ajax=true", function() {
                        $colorContainer.find("figure[data-name='unnamed_color']").addClass("selected");
                        $colorContainer.trigger("selectionChange.depage");
                    });

                    localJS.updateColorPreview(data.node.text);
                })
                .on("rename_node.jstree", function(e, data) {
                    localJS.updateColorPreview(data.node.text);
                })
                .on("ready.jstree", function() {
                    jstreeColors.activate_node($colorTreeContainer.find("ul:first li:first")[0]);
                    $colorContainer.click();

                    if ($body.data("currentLayout") == "pages") {
                        jstreeColors.gainFocus();
                    }
                })
                .on("focus.jstree", function() {
                    $colorContainer.removeClass("focus");
                    $toolbar.removeClass("visible");
                })
                .jstree(true);

            $colorContainer
                .on("selectionChange.depage", function() {
                    var $color = $colorContainer.find(".selected");
                    if ($color.length > 0) {
                        $colorContainer.parent().addClass("color-selected");
                        $deleteButton.removeClass("disabled");
                    } else {
                        $colorContainer.parent().removeClass("color-selected");
                        $deleteButton.addClass("disabled");
                    }
                    localJS.setupColorProperties($color);
                })
                .on("click", function() {
                    $colorContainer.addClass("focus");
                    $toolbar.addClass("visible");

                    jstreeColors.looseFocus();
                })
                .on("click", "figure", function() {
                    var $thumbs = $colorContainer.find("figure");

                    $colorContainer.find(".selected").removeClass("selected");

                    $(this).addClass("selected");

                    $thumbs.blur();

                    $colorContainer.trigger("selectionChange.depage");
                })
                .on("changeColorValue.spectrum", "figure", function() {
                    var $color = $(this);
                    var nodeId = $color.attr("data-nodeid");
                    var value = $color.attr("data-value");

                    $color.children(".preview")
                        .css("backgroundColor", value);

                    localJS.saveColor(nodeId, value);
                })
                .on("changeColorName.spectrum", "figure", function() {
                    var $color = $(this);
                    var nodeId = $color.attr("data-nodeid");
                    var value = $color.attr("data-name");

                    $color.children("figcaption")
                        .text(value);

                    localJS.renameColor(nodeId, value);
                })
                .on("contextmenu", "figure", function(e) {
                    var $thumb = $(this);
                    if (!$thumb.hasClass("selected")) {
                        $thumb.addClass("selected");
                        $colorContainer.trigger("selectionChange.depage");
                    }

                    $.vakata.context.show($(this), {x: e.pageX, y:e.pageY}, {
                        _delete: {
                            label: locale.delete,
                            action: function() {
                                localJS.deleteSelectedColor();
                            }
                        }
                    });

                    return false;
                });
        },
        // }}}
        // {{{ setupColorProperties
        setupColorProperties: function($color) {
            var $colorProps = $(".color-property").empty();

            if (!$color || $color.length == 0) return;

            var $input,
                $nameInput,
                $r, $g, $b,
                $h, $s, $v;

            $input = $("<input />")
                .attr("value", $color.attr("data-value"))
                .on("move.spectrum", function(e, color) {
                    var hex = color.toHexString();
                    var rgb = color.toRgb();
                    var hsv = color.toHsv();

                    $r[0].value = rgb.r;
                    $g[0].value = rgb.g;
                    $b[0].value = rgb.b;

                    $h[0].value = Math.round(hsv.h);
                    $s[0].value = Math.round(hsv.s * 100);
                    $v[0].value = Math.round(hsv.v * 100);

                    $color.attr("data-value", hex);
                    $color.trigger("changeColorValue.spectrum");
                })
                .appendTo($colorProps);


            var p = JSON.parse($(".color-list ul").attr("data-palette"));
            $input.spectrum({
                flat: true,
                preferredFormat: "hex",
                showButtons: false,
                showInitial: true,
                showInput: true,
                showPalette: true,
                showSelectionPalette: false,
                palette: p
            });

            var rgb = $input.spectrum("get").toRgb();
            var hsv = $input.spectrum("get").toHsv();
            var setFromRgbInputs = function() {
                // use rgb presentation to parse to catch errors
                var c1 = $input.spectrum("get");
                var c2 = tinycolor("rgb(" + $r[0].value + "," + $g[0].value + "," + $b[0].value + ")");

                if (c2.isValid()) {
                    // set new color
                    $input.spectrum("set", c2);
                } else {
                    // reset color
                    c2 = c1;
                }
                if (!tinycolor.equals(c1, c2)) {
                    $input.trigger("move.spectrum", c2);
                }
            };
            var setFromHsvInputs = function() {
                // use hsv presentation to parse to catch errors
                var c1 = $input.spectrum("get");
                var c2 = tinycolor("hsv(" + $h[0].value + "," + ($s[0].value / 100) + "," + ($v[0].value / 100) + ")");

                if (c2.isValid()) {
                    // set new color
                    $input.spectrum("set", c2);
                } else {
                    // reset color
                    c2 = c1;
                }
                if (!tinycolor.equals(c1, c2)) {
                    $input.trigger("move.spectrum", c2);
                }
            };

            $r = $("<input />")
                .attr("placeholder", "Red")
                .attr("value", rgb.r);
            $g = $("<input />")
                .attr("placeholder", "Green")
                .attr("value", rgb.g);
            $b = $("<input />")
                .attr("placeholder", "Blue")
                .attr("value", rgb.b);
            $h = $("<input />")
                .attr("min", 0).attr("max", 360)
                .attr("placeholder", "Hue")
                .attr("value", Math.round(hsv.h));
            $s = $("<input />")
                .attr("placeholder", "Saturation")
                .attr("min", 0).attr("max", 100)
                .attr("value", Math.round(hsv.s * 100));
            $v = $("<input />")
                .attr("placeholder", "Brightness")
                .attr("min", 0).attr("max", 100)
                .attr("value", Math.round(hsv.v * 100));

            $().add($r).add($g).add($b).add($h).add($s).add($v)
                .attr("class", "sp-input sp-color-value")
                .attr("type", "number")
                .appendTo(".sp-input-container");

            $().add($r).add($g).add($b)
                .attr("min", 0).attr("max", 255)
                .on("paste blur change", function(e) {
                    setFromRgbInputs(this);
                })
                .on("keydown", function(e) {
                    if (e.keyCode == 13) {
                        setFromRgbInputs(this);
                    }
                });
            $().add($h).add($s).add($v)
                .on("paste blur change", function(e) {
                    setFromHsvInputs(this);
                })
                .on("keydown", function(e) {
                    if (e.keyCode == 13) {
                        setFromHsvInputs(this);
                    }
                });

            $nameInput = $("<input />")
                .attr("class", "sp-input")
                .attr("type", "text")
                .attr("value", $color.attr("data-name"))
                .on("change", function(e) {
                    $color.attr("data-name", this.value);
                    $color.trigger("changeColorName.spectrum");
                })
                .prependTo(".sp-input-container");
        },
        // }}}

        // {{{ loadPageTree
        loadPageTree: function() {
            if ($pageTreeContainer.length === 0) return false;

            var $tree;
            var url = baseUrl + $pageTreeContainer.data("url");

            if (typeof jstreePages != 'undefined') {
                jstreePages.destroy();
            }
            $pageTreeContainer.removeClass("loaded").load(url + "?ajax=true", function() {
                $pageTreeContainer.addClass("loaded");
                $tree = $pageTreeContainer.children(".jstree-container");

                if (!currentPreviewLang) {
                    currentPreviewLang = $tree.data("previewlang");
                }


                jstreePages = $tree.depageTree()
                    .on("activate_node.jstree", function(e, data) {
                        if (typeof window.history != 'undefined') {
                            window.history.replaceState(null, null, baseUrl + "project/" + projectName + "/edit/" + data.node.id + "/");
                        }
                        localJS.loadPagedataTree(data.node.data.docRef);

                        // preview page
                        var url = baseUrl + "project/" + projectName + "/preview/html/pre/" + currentPreviewLang + data.node.data.url;

                        localJS.preview(url);
                    })
                    .on("refresh.jstree refresh_node.jstree", function () {
                        var node = jstreePages.get_selected(true)[0];
                        if (typeof node == 'undefined') return;

                        var url = baseUrl + "project/" + projectName + "/preview/html/pre/" + currentPreviewLang + node.data.url;

                        localJS.preview(url);
                    })
                    .on("ready.jstree", function () {
                        var currentPageId = $pageTreeContainer.attr("data-selected-nodes");
                        if (currentPreviewUrl) {
                            $.ajax({
                                async: true,
                                type: 'POST',
                                url: baseUrl + "api/" + projectName + "/project/pageId/",
                                data: { url: currentPreviewUrl },
                                success: function(data) {
                                    var node = jstreePages.get_node(data.pageId);
                                    if (node) {
                                        jstreePages.activate_node(node);
                                        jstreePages.get_node(node, true)[0].scrollIntoView();
                                    } else {
                                        jstreePages.activate_node($tree.find("ul:first li:first")[0]);
                                    }
                                }
                            });

                            return;
                        } else if (currentPageId) {
                            var node = jstreePages.get_node(currentPageId);
                            if (node) {
                                jstreePages.activate_node(node);
                                jstreePages.get_node(node, true)[0].scrollIntoView();

                                return;
                            }
                        }

                        jstreePages.activate_node($tree.find("ul:first li:first")[0]);

                        if ($body.data("currentLayout") == "pages") {
                            jstreePages.gainFocus();
                        }
                    })
                    .jstree(true);
            });
        },
        // }}}
        // {{{ loadPagedataTree
        loadPagedataTree: function(docref, forceReload) {
            if ($pagedataTreeContainer.length === 0) return false;
            if (!forceReload && currentDocId == docref) return false;

            $pagedataTreeContainer.empty();

            if (!forceReload) {
                $docPropertiesContainer.empty();
            }

            currentDocId = docref;

            if (docref == "") return false;

            var $tree;
            var url = baseUrl + "project/" + projectName + "/tree/" + docref + "/";

            if (typeof jstreePagedata != 'undefined') {
                jstreePagedata.destroy();
            }
            $pagedataTreeContainer.removeClass("loaded").load(url + "?ajax=true", function() {
                $pagedataTreeContainer.addClass("loaded");
                $tree = $pagedataTreeContainer.children(".jstree-container");

                jstreePagedata = $tree.depageTree()
                    .on("activate_node.jstree", function(e, data) {
                        var nodeId = null;
                        if (typeof data.node.data !== 'undefined') {
                            nodeId = data.node.data.nodeId;
                        }
                        localJS.loadDocProperties(docref, nodeId);
                    })
                    .on("ready.jstree", function () {
                        $tree.find("ul:first li").each(function() {
                            //jstreePagedata.open_node(this, false, false);
                            jstreePagedata.open_all();
                        });
                        jstreePagedata.activate_node($tree.find("ul:first li:first")[0]);

                        if ($body.data("currentLayout") == "document") {
                            jstreePagedata.gainFocus();
                        }
                    })
                    .on("refresh.jstree refresh_node.jstree", function (e, updatedIds) {
                        localJS.updatePreview(updatedIds);
                    })
                    .on("destroy.jstree", function () {
                        console.log("destroyed");
                    })
                    .jstree(true);

            });
        },
        // }}}
        // {{{ loadNewsletterTree
        loadNewsletterTree: function() {
            var $newsletterTree = $(".tree.pagedata.newsletter");
            if ($newsletterTree.length === 0) return false;

            if (!currentPreviewLang) {
                currentPreviewLang = $newsletterTree.data("previewlang");
            }
            var newsletterId = $newsletterTree.data("docref");
            var url = baseUrl + "project/" + projectName + "/preview/newsletter/pre/" + currentPreviewLang + "/" + newsletterId + ".html";

            localJS.loadPagedataTree(newsletterId, true);

            localJS.preview(url);
        },
        // }}}
        // {{{ loadDocProperties
        loadDocProperties: function(docref, nodeId) {
            if (currentDocPropertyId == nodeId) return false;

            var $form = $docPropertiesContainer.find('.depage-form');
            if ($form.length > 0) {
                if ($form[0].data.hasChanged) {
                    $form[0].data.autosave();
                }

                if ($form[0].data.saving === true) {
                    $form.hide();
                    setTimeout(function() {
                        localJS.loadDocProperties(docref, nodeId);
                    }, 200);
                } else {
                    localJS.loadDocPropertiesNow(docref, nodeId);
                }

                return false;
            }

            localJS.loadDocPropertiesNow(docref, nodeId);
        },
        // }}}
        // {{{ loadDocPropertiesNow
        loadDocPropertiesNow: function(docref, nodeId) {
            currentDocPropertyId = nodeId;

            var url = baseUrl + "project/" + projectName + "/doc-properties/" + docref + "/" + nodeId + "/";
            var xmldb = new DepageXmldb(baseUrl, projectName, "pages");

            $docPropertiesContainer.find("input[type='color']").spectrum("destroy");

            $docPropertiesContainer.removeClass("loaded").empty().load(url + "?ajax=true", function() {
                $docPropertiesContainer.addClass("loaded");
                var $form = $docPropertiesContainer.find('.depage-form');

                localJS.setupTooltips();

                $form.depageForm();
                $form.find("p.submit").remove();
                $form.find("input, textarea, .textarea-content").on("focus", function() {
                    var lang = $(this).parents("p[lang]").attr("lang");
                    if (typeof lang == "undefined" || lang == "") return;

                    currentPreviewLang = lang;
                    // @todo replace language more intelligently
                    currentPreviewUrl = currentPreviewUrl.replace(/\/(pre|dev)\/..\//, "/$1/" + lang + "/");
                });
                $form.find(".page-navigations input").on("change", function() {
                    var pageId = $(this).parents("p").data("pageid");
                    var attrName = "nav_" + this.value;
                    var attrValue = this.checked ? 'true' : 'false';

                    xmldb.setAttribute(pageId, attrName, attrValue);
                });
                $form.find(".page-tags input").on("change", function() {
                    var pageId = $(this).parents("p").data("pageid");
                    var attrName = "tag_" + this.value;
                    var attrValue = this.checked ? 'true' : 'false';

                    xmldb.setAttribute(pageId, attrName, attrValue);
                });
                $form.find(".page-protection input").on("change", function() {
                    var pageId = $(this).parents("p").data("pageid");
                    var attrName = "db:protected";
                    var attrValue = this.checked ? 'true' : 'false';

                    localJS.setFormState($form, this.checked);

                    xmldb.setAttribute(pageId, attrName, attrValue, function() {
                        localJS.loadPagedataTree(currentDocId, true);
                    });
                });
                $form.find(".page-type select").on("change", function() {
                    var pageId = $(this).parents("p").data("pageid");
                    var attrName = "file_type";
                    var attrValue = this.value;

                    xmldb.setAttribute(pageId, attrName, attrValue);
                });
                $form.find(".doc-property-meta p.release a").on("click", function() {
                    $(this).addClass("disabled");
                    var docRef = $(this).parents("fieldset").data("docref");
                    var xmldb = new DepageXmldb(baseUrl, projectName, docRef);

                    xmldb.releaseDocument();

                    return false;
                });
                $form.find(".doc-property-meta .page-versions").each(function() {
                    var $pageVersionSelect = $(this).find("select[name='pageVersions']");
                    var $rollbackButton = $("<a class=\"button disabled\">" + "Rollback" + "</a>").appendTo(this);
                    $rollbackButton.on("click", function() {
                        if ($(this).hasClass("disabled")) return;

                        $(this).addClass("disabled");
                        var docRef = $(this).parents("fieldset").data("docref");
                        var xmldb = new DepageXmldb(baseUrl, projectName, docRef);
                        var timestamp = $pageVersionSelect[0].value.substring(8);

                        xmldb.rollbackDocument(timestamp, function() {
                            $pageVersionSelect[0].selectize.setValue("", false);
                        });

                        return false;
                    });
                    $pageVersionSelect.on("change", function() {
                        var previewType = this.value || "pre";
                        $rollbackButton.toggleClass("disabled", previewType == "pre");

                        var regex = new RegExp('project/' + projectName + '/preview/html/([^/]*)');
                        var url = currentPreviewUrl.replace(regex, 'project/' + projectName + '/preview/html/' + previewType);

                        localJS.preview(url);
                    });
                });
                $form.find(".doc-property-meta .details").each(function() {
                    var $details = $(this);
                    var $button = $("<span class=\"opener\"></span>").insertBefore($details);

                    $button.on("click", function() {
                        $details.parent().toggleClass("open");
                    });
                });
                $form.find(".edit-src").each(function() {
                    var $input = $(this).find("input");
                    var $button = $("<a class=\"button choose-file\">…</a>").insertAfter($input.parent());

                    $input.on("change", function() {
                        if ($input[0].value == "") {
                            return;
                        }
                        // image changed -> update thumbnail
                        var thumbUrl = url + "thumbnail/" + encodeURIComponent($input[0].value) + "/?ajax=true";

                        $.get(thumbUrl, function(data) {
                            var $thumb = $(data).insertBefore($input.parent().parent());
                            $thumb.prev("figure.thumb").eq(0).remove();
                        });
                    });
                    $button.on("click", function() {
                        if ($(this).hasClass("disabled")) return;

                        localJS.loadFileChooser($input);
                    });
                });
                $form.find(".edit-href").each(function() {
                    var $input = $(this).find("input");
                    var $button = $("<a class=\"button choose-file\">…</a>").insertAfter($input.parent());

                    $button.on("click", function() {
                        if ($(this).hasClass("disabled")) return;

                        localJS.loadFileChooser($input);
                    });
                });
                $form.on("dblclick", "figure.thumb", function() {
                    var $thumb = $(this);
                    var $input = $thumb.next("p").find("input");

                    localJS.chooseImageCenter($thumb, $input);
                });
                $form.on("contextmenu", "figure.thumb", function(e) {
                    var $thumb = $(this);
                    var $input = $thumb.next("p").find("input");

                    $.vakata.context.show($(this), {x: e.pageX, y:e.pageY}, {
                        _chooseCenter: {
                            label: locale.chooseCenter,
                            action: function() {
                                localJS.chooseImageCenter($thumb, $input);
                            }
                        },
                    });

                    return false;
                });
                $form.on("click", "figure.thumb .choose-image-center-button", function() {
                    var $thumb = $(this).parent();
                    var $input = $thumb.next("p").find("input");

                    localJS.chooseImageCenter($thumb, $input);
                });
                $form.find("input[type='color']").spectrum({
                    preferredFormat: "hex",
                    showButtons: false,
                    showInitial: true,
                    showInput: true,
                    showPalette: false,
                    showSelectionPalette: false
                });
                $form.on("depageForm.autosaved", function() {
                    $form.find(".doc-property-meta p.release a").removeClass("disabled");
                });

                $form.find("fieldset.detail").depageDetails({
                    head: "legend"
                });


                localJS.setFormState($form, $form.find(".doc-property-meta").data("protected") == 1);

                // @todo add ui for editing table columns and rows
                // @todo keep squire from merging cells when deleting at the beginning or end of cell
                // @todo add support for better handling of tab key to jump between cells

                localJS.hightlighCurrentDocProperty();
            });
        },
        // }}}
        // {{{ loadLibraryFiles
        loadLibraryFiles: function(path) {
            path = encodeURIComponent(path);
            var url = baseUrl + "project/" + projectName + "/library/files/" + path + "/";
            var $fileContainer = $(".files .file-list");

            $fileContainer.removeClass("loaded").empty().load(url + "?ajax=true", function() {
                localJS.setupFileList();
            });
        },
        // }}}
        // {{{ loadFileChooser
        loadFileChooser: function($input) {
            var path = $input[0].value.replace(/^libref:\/\//, '').replace(/[^\/]*$/, '') || currentLibPath;
            var $inputParent = $input.parent().parent();
            var url = baseUrl + "project/" + projectName + "/library/manager/" + encodeURIComponent(path) + "/";

            currentLibAccept = $inputParent.attr("data-accept") || "";
            currentLibForceSize = $inputParent.attr("data-forceSize") || "";
            currentLibPath = path;

            jstreePages && jstreePages.looseFocus();
            jstreePagedata && jstreePagedata.looseFocus();

            var $dialogContainer = $("<div class=\"dialog-full\"><div class=\"content\"></div></div>")
                .appendTo($body);
            var $dialogContent = $dialogContainer.children(".content");

            if (mobileMediaQuery.matches) {
                $dialogContent.addClass("layout-properties");
            }

            setTimeout(function() {
                $dialogContainer.addClass("visible");
                $(".layout").addClass("no-live-help");
            }, 10);

            $dialogContent.load(url + "?ajax=true", function() {
                $dialogContainer.on("click", function() {
                    localJS.removeFileChooser();
                });
                $dialogContainer.on("click", ".content", function(e) {
                    e.stopPropagation();
                });
                var $dialogBar = $("<div class=\"dialog-bar\"></div>");
                var $ok = $("<a class=\"button default disabled\">" + locale.choose + "</a>").appendTo($dialogBar);
                var $cancel = $("<a class=\"button\">"+ locale.cancel + "</a>").appendTo($dialogBar);

                $ok.on("click.depageFileChooser", function() {
                    if ($(this).hasClass("disabled")) return false;

                    localJS.removeFileChooser($input);
                });
                $cancel.on("click.depageFileChooser", function() {
                    localJS.removeFileChooser();
                });

                $(document).on("keyup.depageFileChooser", function(e) {
                    if ($(".dialog-full.choose-image-center").length > 0) {
                        return;
                    }

                    var key = e.which;
                    if (key === 27) { // ESC
                        localJS.removeFileChooser();
                    } else if (key === 13) { // Enter
                        $ok.click();
                    }
                });

                $dialogBar.prependTo($dialogContent);

                // @todo select input current file if available and scroll into view
                $("figure.thumb[data-libref='" + $input[0].value + "']").addClass("selected");

                localJS.setupLibrary();

                var $fileContainer = $(".files .file-list");
                $fileContainer.on("selectionChange.depage", function() {
                    $ok.toggleClass("disabled", $fileContainer.find(".selected:not(.invalid-selection)").length == 0);
                });

                $dialogContent.on("switchLayout", localJS.switchLayout);
                localJS.updateLayoutButtons($dialogContent);
            });
        },
        // }}}
        // {{{ removeFileChooser()
        removeFileChooser: function($input) {
            var jstree;
            var $dialogContainer = $(".dialog-full");
            var $selected = $dialogContainer.find("figure.selected:not(.invalid-selection)");

            if (typeof $input !== 'undefined' && $selected.length > 0) {
                $input[0].value = $selected.attr("data-libref");
                $input.trigger("change");
            }

            $(document).off("keyup.depageFileChooser");
            $(".toolbar-filelist").remove();
            if ((jstree = $(".tree.library .jstree-container").jstree(true))) {
                jstree.destroy();
                jstreeLibrary = false;
            }

            // focus document tree
            jstreePagedata.gainFocus();

            $dialogContainer.removeClass("visible");
            $(".layout").removeClass("no-live-help");
            setTimeout(function() {
                $dialogContainer.remove();
            }, 500);
        },
        // }}}
        // {{{ checkSelectedFiles()
        checkSelectedFiles: function($input) {
            var $fileContainer = $(".files .file-list");
            var $files = $fileContainer.find(".selected");
            var exts = [];
            var matches = /(\d+|X)x(\d+|X)/.exec(currentLibForceSize);
            var width = "X", height = "X";

            if (currentLibAccept != "") {
                exts = currentLibAccept.split(",");
            }
            if (matches && matches.length == 3) {
                width = matches[1];
                height = matches[2];
            }

            $(".file-list > .message").remove();
            var $message = $("<p class=\"message\"></p>").insertBefore(".dialog-full .file-list > ul");

            $message.append("<b>" + locale.chooseFileMessage + "</b>");
            $message.append("<br>");

            if (width == "X" && height == "X" && exts.length == 0) return;

            if (exts.length > 0) {
                $message.append(document.createTextNode(currentLibAccept));
                $message.append("<br>");
            }
            if (width != "X") {
                $message.append(document.createTextNode(locale.forceWidthMessage + width + "px"));
                $message.append("<br>");
            }
            if (height != "X") {
                $message.append(document.createTextNode(locale.forceHeightMessage + height + "px"));
                $message.append("<br>");
            }

            // @todo add message about selectable files

            $files.each(function() {
                var $file = $(this);

                if (exts.length > 0) {
                    var ext = "." + $file.attr("data-ext");
                    if (exts.indexOf(ext) == -1) {
                        $file.addClass("invalid-selection");
                    }
                }
                if (width != "X") {
                    if ($file.attr("data-width") != width) {
                        $file.addClass("invalid-selection");
                    }
                }
                if (height != "X") {
                    if ($file.attr("data-height") != height) {
                        $file.addClass("invalid-selection");
                    }
                }
            });
        },
        // }}}
        // {{{ deleteSelectedFiles()
        deleteSelectedFiles: function() {
            var $fileContainer = $(".files .file-list");
            var $files = $fileContainer.find(".selected");
            var files = [];

            if ($files.length == 0) return;

            $files.each(function() {
                files.push($(this).attr("data-libref"));
            });

            var pos = $files.eq(0).offset();
            var url = baseUrl + "project/" + projectName + "/library/delete/";

            pos.top += 135;
            pos.left += 100;

            $body.depageShyDialogue({
                ok: {
                    title: locale.delete,
                    classes: 'default',
                    click: function(e) {
                        $.post(url, {
                            files: files
                        }, function() {
                            $files.parent().remove();
                            $fileContainer.trigger("selectionChange.depage");
                        });

                        return true;
                    }
                },
                cancel: {
                    title: locale.cancel
                }
            },{
                bind_el: false,
                directionMarker: true,
                actionActiveTimeout: 1000,
                title: locale.delete,
                message: locale.deleteQuestion
            });

            $body.data("depage.shyDialogue").showDialogue(pos.left, pos.top);
        },
        // }}}
        // {{{ chooseImageCenter()
        chooseImageCenter: function($thumb, $input) {
            var libid = $thumb.data("libid") || false
            if (!libid) {
                return;
            }
            var fileId = libid.match(/libid:\/\/(\d+)\/(.*)/)[1];
            var $dialog = $("<div class=\"dialog-full choose-image-center\"><div class=\"content\"><div class=\"dialog-bar\"></div><div class=\"center-selector scrollable-content\"><figure class=\"thumb\"></figure><div class=\"examples\"></div></div></div></div>");
            var $examples = $dialog.find(".examples");
            var $dialogBar = $dialog.find(".dialog-bar");
            var $zoomed = $dialog.find("figure.thumb");
            var $img = $thumb.find("img").clone(false);
            var $ok = $("<a class=\"button default\"></a>");
            var $reset = $("<a class=\"button\"></a>");
            var $cancel = $("<a class=\"button\"></a>");
            var $cursor = $("<a class=\"cursor\"></a>");
            var centerX = $thumb.data("center-x");
            var centerY = $thumb.data("center-y");
            var src = $img[0].src;
            var dragging = false;

            var createExample = function(className) {
                var $copy = $img
                    .clone(false);

                $copy[0].src = src.replace(/\.t\d+x\d+\.png$/, ".t320xX.jpg");

                $copy
                    .addClass(className)
                    .appendTo($examples);


                return $copy;
            }
            var moveCursor = function(x, y) {
                centerX = Math.min(100, Math.max(0, x));
                centerY = Math.min(100, Math.max(0, y));

                $cursor.css({
                    left: centerX + "%",
                    top:  centerY + "%"
                });
                $examples.children("img").css({
                    'object-position': centerX + "% " + centerY + "%"
                });
            };
            var save = function() {
                $thumb.attr("data-center-x", centerX);
                $thumb.attr("data-center-y", centerY);

                $.ajax({
                    async: true,
                    type: 'POST',
                    url: baseUrl + "api/" + projectName + "/library/set-image-center/",
                    data: {
                        fileId: fileId,
                        centerX: centerX,
                        centerY: centerY
                    },
                });
            };

            createExample("example1");
            createExample("example2");
            createExample("example3");
            createExample("example4");

            $img.attr("width", $thumb.attr("data-width"));
            $img.attr("height", $thumb.attr("data-height"));
            $img[0].src = src.replace(/\.t\d+x\d+\.png$/, ".t1024xX.jpg");

            $ok
                .text(locale.ok)
                .appendTo($dialogBar)
                .on("click", function() {
                    save();

                    localJS.removeImageCenterChooser($input);
                });
            $reset
                .text(locale.reset)
                .appendTo($dialogBar)
                .on("click", function() {
                    moveCursor(50, 50);
                });
            $cancel
                .text(locale.cancel)
                .appendTo($dialogBar)
                .on("click", function() {
                    localJS.removeImageCenterChooser();
                });

            $img.prependTo($zoomed);
            $("<h1>" + locale.chooseCenterHint + "</h1>").insertBefore($zoomed);
            $("<p>" + locale.chooseCenterExamples + "</p>").insertAfter($zoomed);
            $dialog.appendTo($body);
            $cursor
                .insertBefore($img);

            moveCursor(centerX, centerY);

            $zoomed
                .on("mousedown", function() {
                    dragging = true;
                })
                .on("mouseup", function(e) {
                    dragging = false;

                    var rect = this.getBoundingClientRect();

                    moveCursor(
                        Math.round((e.clientX - rect.left) / $img.width() * 100),
                        Math.round((e.clientY - rect.top) / $img.height() * 100)
                    );
                })
                .on("mousemove", function(e) {
                    if (!dragging) {
                        return;
                    }
                    var rect = this.getBoundingClientRect();

                    moveCursor(
                        Math.round((e.clientX - rect.left) / $img.width() * 100),
                        Math.round((e.clientY - rect.top) / $img.height() * 100)
                    );

                    e.stopPropagation();
                    e.preventDefault();

                    return false;
                });

            $(document).on("keyup.depageChooseImageCenter", function(e) {
                var key = e.which;
                if (key === 27) { // ESC
                    localJS.removeImageCenterChooser();
                } else if (key === 13) { // Enter
                    $ok.click();
                }
            });

            setTimeout(function() {
                $dialog.addClass("visible");
                $(".layout").addClass("no-live-help");
            }, 50);
        },
        // }}}
        // {{{ removeImageCenterChooser()
        removeImageCenterChooser: function($input) {
            var $dialog = $(".dialog-full.choose-image-center");

            if (typeof $input !== 'undefined') {
                var old = $input[0].value;
                $input[0].value = "";
                $input.trigger("change");

                $input[0].value = old;
                $input.trigger("change");
            }

            $dialog.removeClass("visible");
            $(".layout").removeClass("no-live-help");

            $(document).off("keyup.depageChooseImageCenter");

            setTimeout(function() {
                $dialog.remove();
            }, 500);
        },
        // }}}
        // {{{ addColor()
        addColor: function() {
            var $colorContainer = $(".colorscheme .color-list");
            var colorType = $colorContainer.children("ul").attr("data-type");
            var colorschemeId = $colorContainer.children("ul").attr("data-colorschemeid");
            var url = baseUrl + "project/" + projectName + "/colors/addColor/";

            $.post(url, {
                colorType: colorType
            }, function() {
                var url = baseUrl + "project/" + projectName + "/colors/edit/" + colorschemeId + "/";

                $colorContainer.removeClass("loaded").load(url + "?ajax=true", function() {
                    $colorContainer.trigger("selectionChange.depage");
                });
            });
        },
        // }}}
        // {{{ saveColor()
        saveColor: _.throttle(function(nodeId, value) {
            var xmldb = new DepageXmldb(baseUrl, projectName, "colors");
                xmldb.setAttribute(nodeId, "value", value, function() {
                    localJS.updateColorPreview();
                });
        }, 750, {
            leading: true,
            trailing: true
        }),
        // }}}
        // {{{ renameColor()
        renameColor: function(nodeId, value) {
            var url = baseUrl + "project/" + projectName + "/colors/renameColor/";

            $.post(url, {
                id: nodeId,
                name: value
            });
        },
        // }}}
        // {{{ deleteSelectedColor()
        deleteSelectedColor: function(nodeId) {
            var url = baseUrl + "project/" + projectName + "/colors/deleteColor/";
            var $colorContainer = $(".colorscheme .color-list");
            var $colors = $colorContainer.find(".selected");
            var colorId = $colors.attr("data-nodeid");

            if ($colors.length == 0) return;

            var pos = $colors.eq(0).offset();

            pos.top += 75;
            pos.left += 100;

            $body.depageShyDialogue({
                ok: {
                    title: locale.delete,
                    classes: 'default',
                    click: function(e) {
                        $.post(url, {
                            id: colorId
                        }, function() {
                            $colors.parent().remove();
                            $colorContainer.trigger("selectionChange.depage");
                        });
                    }
                },
                cancel: {
                    title: locale.cancel
                }
            },{
                bind_el: false,
                directionMarker: true,
                actionActiveTimeout: 1000,
                title: locale.delete,
                message: locale.deleteQuestion
            });

            $body.data("depage.shyDialogue").showDialogue(pos.left, pos.top);
        },
        // }}}
        // {{{ addNewPost()
        addNewPost: function(projectName) {
            var url = baseUrl + "project/" + projectName + "/add-new-post/";

            $.post(url, {
                projectName: projectName
            }, function(data) {
                if (!data.pageId) return;

                var url = baseUrl + "project/" + projectName + "/edit/" + data.pageId + "/";

                window.location = url;
            });
        },
        // }}}

        // {{{ setFormState()
        setFormState: function($form, disabled) {
            var $protectionInput = $form.find(".page-protection input");

            $form.find("input, select, textarea, button").not($protectionInput)
                .attr('disabled', disabled);

            $form.find(".textarea-content")
                .attr('contenteditable', !disabled)
                .parent().toggleClass('disabled', disabled);

            $form.find("a.choose-file").toggleClass('disabled', disabled);

            $form.find("select").each(function() {
                if (disabled) {
                    this.selectize.disable();
                } else {
                    this.selectize.enable();
                }
            });
        },
        // }}}

        // {{{ wakeFromSleep
        wakeFromSleep: function() {
            // @todo check if user is still logged in and show message when he isnt
            // @todo redirecto to login page when logged out?
            console.log("woken up from sleep? -> check login");
        },
        // }}}

        // {{{ updateAjaxContent
        updateAjaxContent: function() {
            if (window != window.top) {
                // don't call this in iframed content
                return;
            }
            var url = "overview/";
            var timeout = 5000;

            $.ajax({
                url: baseUrl + url.trim() + "?ajax=true",
                success: function(responseText, textStatus, jqXHR) {
                    if (!responseText) {
                        return;
                    }
                    var $html = $(responseText);
                    var found = false;

                    // get children with ids and replace content
                    $html.filter("[id]").each( function() {
                        var $el = $(this);
                        var id = this.id;
                        var newTimeout = $el.find("*[data-ajax-update-timeout]").data("ajax-update-timeout");

                        if (newTimeout && newTimeout < timeout) {
                            timeout = newTimeout;
                        }
                        var $target = $("#" + id);
                        if ($target.length > 0) {
                            $target.empty().append($el.children());
                            found = true;
                        }
                    });

                    // get script elements
                    $html.filter("script").each( function() {
                        $body.append(this);
                    });
                    if (found) {
                        setTimeout(localJS.updateAjaxContent, timeout);
                    }
                }
            });
        },
        // }}}

        // {{{ onMobileSwitch
        onMobileSwitch: function(e) {
            localJS.updateLayoutButtons($body);

            if (e.matches) {
                // mobile
                $body.triggerHandler("switchLayout", "pages");
            } else {
                // default
                $body.triggerHandler("switchLayout", "split");
            }
        },
        // }}}
        // {{{ switchLayout
        switchLayout: function(event, layout) {
            var $layoutRoot = $(this);
            var $toolbarLayout = $layoutRoot.children(".layout-buttons");
            var $layoutButtons = $toolbarLayout.find("a");
            var layouts = $layoutRoot.data("layouts");

            var currentLayout = layout;

            if (typeof event.data != "undefined" && typeof event.data.layout != "undefined") {
                currentLayout = event.data.layout;
            }

            if (layouts.filter(l => l == currentLayout).length == 0) {
                currentLayout = layouts[0];
            }

            if ($("div.preview").length === 0) {
                $(".preview-buttons").hide();
            } else {
                $(".preview-buttons").css({display: "inline-block"});
            }
            $layoutRoot
                .removeClass(function(i, className) {
                    var classes = className.split(" ");
                    classes = classes.filter(function(c) {
                        return c.match(/layout-/);
                    });
                    return classes.join('');
                })
                .addClass("layout-" + currentLayout);

            $layoutButtons
                .removeClass("active")
                .filter(".to-layout-" + currentLayout).addClass("active");

            if (currentLayout != "left-full") {
                localJS.updatePreview();
            }

            var currentTree = false;
            if (currentLayout == "pages") {
                currentTree = jstreeLibrary || jstreeColors || jstreePages || false;
            } else if (currentLayout == "document") {
                currentTree = jstreePagedata || false;
            }

            var $nonTreeLayouts = $(".layout-properties .file-list, .layout-properties .color-list, .layout-properties .doc-properties");
            if (currentTree && currentTree.element != null) {
                currentTree.gainFocus();
                $nonTreeLayouts.removeClass("focus");
            } else {
                $nonTreeLayouts.addClass("focus");
            }

            $layoutRoot.data("currentLayout", currentLayout);
        },
        // }}}
        // {{{ preview
        preview: function(url, updatedIds) {
            if (typeof url == 'undefined' || url[0] == "/") return;
            updatedIds = updatedIds || [];

            if (parent != window) {
                parent.depageCMS.preview(url);
            } else if ($previewFrame.length == 1) {
                var newUrl = unescape(url);
                var oldUrl = "";
                try {
                    oldUrl = $previewFrame[0].contentWindow.location.href;
                } catch(error) {
                }

                if (newUrl.substring(0, baseUrl.length) != baseUrl) {
                    newUrl = baseUrl + newUrl;
                }
                currentPreviewUrl = newUrl;

                if ($body.data("currentLayout") == "left-full") {
                    // @todo load preview when changing layout?
                    return;
                }

                clearTimeout(previewUpdateTimer);

                previewStarted = Date.now();
                previewLoading = true;

                if (oldUrl == newUrl) {
                    try {
                        var $iframe = $previewFrame.contents();

                        // only use live updated when changes are inside elements themselves
                        if (updatedIds.length == 0) {
                            $previewFrame[0].contentWindow.location.reload();

                            return;
                        }
                        $.get(newUrl, function(data) {
                            var $loaded = $.parseHTML(data);
                            var found = 0;

                            for (var i in updatedIds) {
                                var id = updatedIds[i];
                                var $current = $iframe.find("*[data-db-id='" + id + "']");
                                var $new = $($loaded).find("*[data-db-id='" + id + "']");

                                $new.find("*").andSelf().addClass("depage-live-edit-updated");

                                if ($current.length == 1 && $new.length == 1) {
                                    $current.replaceWith($new);
                                    found++;
                                }
                            }
                            if (found == updatedIds.length) {
                                localJS.onPreviewUpdated();
                            } else {
                                $previewFrame[0].contentWindow.location.reload();
                            }
                        });
                    } catch(error) {
                        $previewFrame[0].contentWindow.location.reload();
                    }
                } else {
                    var $newFrame = $("<iframe />").insertAfter($previewFrame);
                    $previewFrame.remove();
                    $previewFrame = $newFrame.attr("id", "previewFrame");
                    $previewFrame.one("load", localJS.hightlighCurrentDocProperty);
                    $previewFrame.on("load", localJS.onPreviewUpdated);
                    $previewFrame[0].contentWindow.addEventListener('DOMContentLoaded', function() {
                        localJS.onPreviewUpdated();
                    });
                    $previewFrame[0].src = newUrl;
                }
            } else {
                // add preview frame
                var projectName = url.match(/project\/(.*)\/preview/)[1];

                $.get(baseUrl + "project/" + projectName + "/edit/?ajax=true", function(data) {
                    var $result = $("<div></div>")
                        .html( data )
                        .find("div.preview")
                        .appendTo($body);

                    $previewFrame = $("#previewFrame");
                    $previewFrame.one("load", localJS.hightlighCurrentDocProperty);
                    $previewFrame.on("load", localJS.onPreviewUpdated);
                    $previewFrame[0].contentWindow.addEventListener('DOMContentLoaded', function() {
                        localJS.onPreviewUpdated();
                    });
                    currentPreviewUrl = unescape(url);
                    $previewFrame[0].src = currentPreviewUrl;

                    localJS.updateLayoutButtons($body);

                    if (mobileMediaQuery.matches) {
                        $body.triggerHandler("switchLayout", "preview");
                    } else {
                        $body.triggerHandler("switchLayout", "split");
                    }
                });
            }
        },
        // }}}
        // {{{ updateLayoutButtons
        updateLayoutButtons: function($layoutRoot) {
            var layouts = [];

            var $toolbarLayout = $layoutRoot.children(".layout-buttons");
            if ($toolbarLayout.length == 0) {
                $toolbarLayout = $("<menu class=\"toolbar layout-buttons\" data-live-help=\"" + locale.layoutSwitchHelp + "\"></menu>").prependTo($layoutRoot);
            }

            $toolbarLayout.empty();

            if (mobileMediaQuery.matches) {
                if ($layoutRoot.children(".layout-tree").length == 1) {
                    layouts.push("pages");
                }
                if ($layoutRoot.children(".layout-tree-top").length == 1) {
                    layouts.push("pages");
                }
                if ($layoutRoot.children(".layout-tree-bottom").length == 1) {
                    layouts.push("document");
                }
                layouts.push("properties");
            } else {
                layouts.push("left-full");
                if ($layoutRoot.children(".preview").length == 1) {
                    layouts.push("split");
                }
            }
            if ($layoutRoot.children(".preview").length == 1) {
                layouts.push("preview");
            }

            // add layout button
            for (var i in layouts) {
                (function() {
                    var newLayout = layouts[i];
                    var tooltip = locale["layout-" + newLayout];
                    var activeClass = newLayout == $body.data("currentLayout") ? " active" : "";
                    $("<a class=\"toggle-button to-layout-" + newLayout + activeClass + "\" aria-label=\"" + tooltip + "\" data-tooltip=\"" + tooltip + "\"></a>")
                        .appendTo($toolbarLayout)
                        .on("click", function() {
                            $layoutRoot.triggerHandler("switchLayout", newLayout)
                        });
                })();
            }

            $toolbarLayout.toggleClass("visible", layouts.length > 1);
            $layoutRoot.data("layouts", layouts);
        },
        // }}}
        // {{{ updatePreview
        updatePreview: _.throttle(function(updatedIds) {
            if (previewLoading) {
                setTimeout(function() {
                    localJS.updatePreview(updatedIds);
                }, previewLoadTime);

                return;
            }
            this.preview(currentPreviewUrl, updatedIds);
        }, 500, {
            leading: false,
            trailing: true
        }),
        // }}}
        // {{{ updateColorPreview
        updateColorPreview: function(colorscheme) {
            if (typeof colorscheme != 'undefined') {
                currentColorScheme = colorscheme
            }
            var url = currentLoadedUrl;

            if (!url) {
                url = baseUrl + "project/" + projectName + "/preview/html/dev/";
            }
            url = url.replace(/\?.*/, "");
            if (currentColorScheme != "Global Colors") {
                url += "?__dpPreviewColor=" + encodeURIComponent(currentColorScheme);
            }

            localJS.preview(url);
        },
        // }}}
        // {{{ hightlighCurrentDocProperty
        hightlighCurrentDocProperty: function() {
            try {
                var className = "depage-live-edit-highlight";
                var $iframe = $previewFrame.contents();
                var $current = $iframe.find("*[data-db-id='" + currentDocPropertyId + "']");

                $iframe.find("." + className).removeClass(className);
                $current.addClass(className);
                if ($current.length == 1) {
                    $current[0].scrollIntoView();
                    var $scroller = $current.scrollParent();
                    $scroller.scrollTop($scroller.scrollTop() - 100);
                }
            } catch(error) {
            }
        },
        // }}}
        // {{{ onPreviewUpdated
        onPreviewUpdated: function() {
            var title = "",
                oldTitle,
                lastLoadTime;

            if (!previewLoading) {
                return;
            }

            previewLoading = false;
            lastLoadTime = Date.now() - previewStarted;
            previewLoadTime = lastLoadTime - 1000;
            previewLoadTime = Math.min(4000, Math.max(200, previewLoadTime));
            //console.log("load times: " + lastLoadTime + "/" + previewLoadTime);

            previewUpdateTimer = setInterval(function () {
                try {
                    title = $previewFrame[0].contentDocument.title;
                    currentLoadedUrl = $previewFrame[0].contentWindow.location.href;
                } catch(error) {
                }

                if (title != oldTitle) {
                    $("div.preview header.info span.title")
                        .text(title)
                        .attr("data-tooltip", title);
                    oldTitle = title;
                }
            }, 500);
        },
        // }}}
        // {{{ edit
        edit: function(pName, page) {
            if (jstreePages) {
                $.ajax({
                    async: true,
                    type: 'POST',
                    url: baseUrl + "api/" + pName + "/project/pageId/",
                    data: { url: page },
                    success: function(data, status) {
                        var node = jstreePages.get_node(data.pageId);
                        if (node) {
                            jstreePages.activate_node(node);
                            jstreePages.get_node(node, true)[0].scrollIntoView();
                        }

                        $body.triggerHandler("switchLayout", "split");
                    }
                });
            } else {
                $.get(baseUrl + "project/" + pName + "/edit/?ajax=true", function(data) {
                    var $result = $("<div></div>")
                        .html( data )
                        .find("div.edit")
                        .appendTo($body);
                    var $header = $result.find("header.info");
                    projectName = pName;
                    currentPreviewUrl = page;

                    localJS.setupTrees();

                    $body.triggerHandler("switchLayout", "split");
                });
            }
            if (typeof window.history != 'undefined') {
                window.history.pushState(null, null, baseUrl + "project/" + pName + "/edit/");
            }
        },
        // }}}

        // {{{ handleNotifications
        handleNotifications: function(n) {
            var action = null;
            var duration = 3000;
            var options = {
                message: n.message,
                backend: 'html'
            };

            if (typeof n.options.link == 'string') {
                options.onClick = function() {
                    window.location = n.options.link;
                };
                options.duration = 10000;
            }

            $.depage.growl(n.title, options);
        },
        // }}}
        // {{{ handleTaskMessage
        handleTaskMessage: function(tasks) {
            var $wrappers = $(".task-progress");
            var percent = 0;
            var i, prop;

            for (prop in currentTasks) {
                currentTasks[prop] = false;
            }

            if (tasks.length > 0) {
                if (Object.keys(currentTasks).length == 0) {
                    $(".task-progress .task-list").text("");
                }
                $("#toolbarmain .task-progress").show();
            } else {
                localJS.cleanTaskProgress();
                $("#toolbarmain .task-progress").hide();
                $(".task-progress .task-list").text(locale.noCurrentTasks);

                return;
            }

            // render global progress
            // @todo keep number of tasks until back to zero
            percent = Math.round(tasks.reduce(function(a, task) { return a + task.percent; }, 0) / tasks.length);
            localJS.renderProgressFor($wrappers.children(".task-overview"), "global", "global", "", percent, "", "");

            // render local progress
            for (i = 0; i < tasks.length; i++) {
                var t = tasks[i];

                localJS.renderProgressFor($wrappers.children(".task-list"), t.id, t.name, t.project, t.percent, t.description, t.status);
            }

            localJS.cleanTaskProgress();

            clearTimeout(currentTasksTimeout);
            currentTasksTimeout = setTimeout(function() {
                localJS.cleanTaskProgress(true);
            }, 2500);
        },
        // }}}
        // {{{ renderProgressFor
        renderProgressFor: function($wrappers, taskId, name, project, percent, description, status) {
            var lastFrame = +(new Date()) - 100;

            $wrappers.each(function(i, wrapper) {
                var id = "task-progress-" + i + "-" + taskId;
                var $t = $("#" + id);
                var $b;

                currentTasks[id] = true;

                if ($t.length == 0) {
                    $t = $("<div id=\"" + id + "\"><strong></strong><progress max=\"100\"></progress><em></em><br /><em></em></div>").appendTo(wrapper);

                    if (taskId != "global") {
                        $b = $("<a class=\"button\"></a>")
                            .text(locale.delete)
                            .appendTo($t)
                            .depageShyDialogue({
                                ok: {
                                    title: locale.delete,
                                    classes: 'default',
                                    click: function(e) {
                                        $.ajax({
                                            async: true,
                                            type: 'POST',
                                            url: baseUrl + "api/-/task/delete/",
                                            data: { taskId: taskId }
                                        });

                                        return true;
                                    }
                                },
                                cancel: {
                                    title: locale.cancel
                                }
                            },{
                                title: locale.delete,
                                message : locale.deleteQuestion,
                                actionActiveTimeout: 1000,
                                directionMarker: true
                            });
                    }
                }

                var $p = $t.children("progress");
                var $pText = $t.children("strong");
                var targetP = percent;
                var lastP = parseFloat($p.attr("value")) || 0;

                $pText.text(lastP + "%");
                if (lastP != 0) {
                    $p.attr("value", lastP);
                }
                $t.children("em").eq(0).text(name);
                $t.children("em").eq(1).text(description);

                if (status == 'failed') {
                    $t.addClass("error");
                }

                animLoop(function(deltaT, now) {
                    var timeDiff = now - lastFrame;
                    if (timeDiff > 1000) {
                        // run for maximal 1 second until next update from websocket server
                        return false;
                    }

                    var newP = lerp(lastP, targetP, timeDiff / 1000);
                    var newPfloored = Math.floor(newP);

                    if (newP - newPfloored < 1) {
                        newP = newPfloored;
                    }
                    if (lastP == newP) {
                        return;
                    }

                    lastP = newP;

                    $pText.text(newP + "%");
                    if (newP != 0) {
                        $p.attr("value", newP);
                    }
                });
            });
        },
        // }}}
        // {{{ cleanTaskProgress
        cleanTaskProgress: function(force) {
            for (var prop in currentTasks) {
                if (force || !currentTasks[prop]) {
                    $("#" + prop).remove();

                    delete currentTasks[prop];
                }
            }
        },
        // }}}

        // {{{ addToolbarButton
        addToolbarButton: function($container, name, className, callback) {
            var $button = $("<a></a>");
            $button
                .text(name)
                .addClass("button")
                .addClass(className)
                .attr("title", name)
                .on("click", function() {
                    if (!$(this).hasClass("disabled")) callback.apply(this);
                });

            $button.appendTo($container);

            return $button;
        },
        // }}}

        // {{{ logout
        logout: function() {
            var logoutUrl = baseUrl + "logout/";

            $.ajax({
                type: "GET",
                url: logoutUrl,
                cache: false,
                username: "logout",
                password: "logout",
                complete: function(XMLHttpRequest, textStatus) {
                    window.location = baseUrl;
                },
                error: function() {
                    window.location = logoutUrl;
                }
            });
        }
        // }}}
    };

    return localJS;
})();

// {{{ register events
$(document).ready(function() {
    depageCMS.ready();
});
// }}}

// vim:set ft=javascript sw=4 sts=4 fdm=marker :
