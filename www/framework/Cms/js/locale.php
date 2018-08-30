<?php
    $locales = [];
    $localeDir = __DIR__ . "/../../locale";
    $textdomain = "messages";

    $dirs = glob("$localeDir/*", GLOB_ONLYDIR);

    foreach ($dirs as $dir) {
        $locale = basename($dir);
        $lang = substr($locale, 0, 2);

        bindtextdomain($textdomain, $localeDir);
        bind_textdomain_codeset($textdomain, 'UTF-8');
        textdomain($textdomain);

        putenv('LANGUAGE=' . $locale . ".UTF-8");
        putenv('LC_ALL=' . $locale . ".UTF-8");
        setlocale(LC_ALL, $locale . ".UTF-8");

        $locales[$lang] = [
            "cancel" => _("Cancel"),
            "choose" => _("Choose"),
            "chooseFileMessage" => _("Please choose a file"),
            "copy" => _("Copy"),
            "create" => _("New"),
            "createNew" => _("Create new:"),
            "createNoElements" => _("There are no elements that can be created in this element"),
            "cut" => _("Cut"),
            "delete" => _("Delete"),
            "deleteQuestion" => _("Delete this element now?"),
            "deselectAll" => _("Deselect all"),
            "duplicate" => _("Duplicate"),
            "edit" => _("Edit"),
            "editHelp" => _("Edit current page in edit interface on the left ←."),
            "forceHeightMessage" => _("Height: "),
            "forceWidthMessage" => _("Width: "),
            "layoutSwitchHelp" => _("Switch layout to: Edit-only, Split-view and Preview-only"),
            "newPost" => _("News- or blog-post"),
            "noCurrentTasks" => _("No current tasks."),
            "ok" => _("Ok"),
            "paste" => _("Paste"),
            "projectFilter" => _("Filter Projects"),
            "reload" => _("Reload"),
            "reloadHelp" => _("Reload page preview"),
            "rename" => _("Rename"),
            "selectAll" => _("Select all"),
            "uploadFinishedCancel" => _("Finished uploading/Cancel"),
            "zoomHelp" => _("Change zoom level of preview."),
        ];
    }

    $javascript = "depageCMSlocale = " . json_encode($locales) . ";";

    file_put_contents(__DIR__ . "/locale.js", $javascript);

// vim:set ft=php sw=4 sts=4 fdm=marker et :
