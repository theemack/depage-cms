<?php
/**
 * @file    framework/Cms/Ui/DocProperties.php
 *
 * depage cms edit module
 *
 *
 * copyright (c) 2011-2018 Frank Hellenkamp [jonas@depage.net]
 *
 * @author    Frank Hellenkamp [jonas@depage.net]
 */

namespace Depage\Cms\Ui;

use \Depage\Html\Html;

class DocProperties extends Base
{
    // {{{ variables
    /**
     * @brief projectName
     **/
    protected $projectName = "";

    /**
     * @brief docRef
     **/
    protected $docRef = null;

    /**
     * @brief nodeId
     **/
    protected $nodeId = null;

    /**
     * @brief project
     **/
    protected $project = null;

    /**
     * @brief xmldb
     **/
    protected $xmldb = null;

    /**
     * @brief languages
     **/
    protected $languages = [];

    /**
     * @brief form
     **/
    protected $form = null;

    /**
     * @brief fs
     **/
    protected $fs = null;
    // }}}

    // {{{ _init()
    public function _init(array $importVariables = []) {
        parent::_init($importVariables);

        if (!empty($this->urlSubArgs[0])) {
            $this->projectName = $this->urlSubArgs[0];
        }
        if (!empty($this->urlSubArgs[1])) {
            $this->docRef = $this->urlSubArgs[1];
        }
        if (!empty($this->urlSubArgs[2])) {
            $this->nodeId = $this->urlSubArgs[2];
        }

        $this->project = \Depage\Cms\Project::loadByUser($this->pdo, $this->xmldbCache, $this->authUser, $this->projectName)[0];
        $this->xmldb = $this->project->getXmlDb($this->authUser->id);
        $this->fl = new \Depage\Cms\FileLibrary($this->pdo, $this->project);

        $this->languages = array_keys($this->project->getLanguages());
    }
    // }}}
    // {{{ package
    /**
     * gets a list of projects
     *
     * @return  null
     */
    public function package($output) {
        // pack into base-html if output is html-object
        if (!isset($_REQUEST['ajax']) && is_object($output) && is_a($output, "Depage\Html\Html")) {
            // pack into body html
            $output = new Html("html.tpl", [
                'title' => $this->basetitle,
                'subtitle' => $output->title,
                'content' => $output,
            ], $this->htmlOptions);
        }

        return $output;
    }
    // }}}

    // {{{ index
    /**
     * default function to call if no function is given in handler
     *
     * @return  null
     */
    public function index() {
        $this->auth->enforce();

        $h = "";
        $doc = $this->xmldb->getDocByNodeId($this->nodeId);
        $xml = $doc->getSubdocByNodeId($this->nodeId);
        $this->doc = $doc;

        $xpath = new \DOMXPath($xml);
        $xpath->registerNamespace("db", "http://cms.depagecms.net/ns/database");

        $node = $xml->documentElement;
        $hashOld = $doc->hashDomNode($node);

        $this->form = new \Depage\Cms\Forms\XmlForm("xmldata_{$this->nodeId}", [
            'jsAutosave' => true,
            'dataNode' => $node,
            'class' => "labels-on-top",
            'ttl' => $this->auth->sessionLifetime,
            'fl' => $this->fl,
        ]);

        if ($node->getAttribute("icon")) {
            //$this->form->addHtml("<p>Icon: " . $node->getAttribute("icon") . "</p>");
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET' && in_array($node->prefix, ['pg', 'sec', 'edit'])) {
            // only for page data content and only for get request
            $this->addPgRelease($node);
        }

        $nodes = array_merge([$node], iterator_to_array($node->childNodes));
        foreach($nodes as $n) {
            if ($callback = $this->getCallbackForNode($n, "add")) {
                $this->$callback($n);
                $hasInputs = true;
            }
        }
        $this->form->setDefaultValuesXml();

        $this->form->process();

        if ($hasInputs && $this->form->validateAutosave()) {
            // @todo check if content has changed
            $released = $doc->isReleased();
            $node = $this->form->getValuesXml();
            $hashNew = $doc->hashDomNode($node);
            $changed = $hashOld !== $hashNew;
            $savedAlready = false;

            foreach($nodes as $n) {
                if ($callback = $this->getCallbackForNode($n, "save")) {
                    $changed = $this->$callback($n) || $changed;
                    $savedAlready = true;
                }
            }

            if ($changed && !$savedAlready) {
                $doc->saveNode($node);
            }
            if ($changed) {
                $prefix = $this->pdo->prefix . "_proj_" . $this->projectName;
                $deltaUpdates = new \Depage\WebSocket\JsTree\DeltaUpdates($prefix, $this->pdo, $this->xmldb, $doc->getDocId(), $this->project, 0);
                $parentId = $doc->getParentIdById($this->nodeId);
                $deltaUpdates->recordChange($parentId);

                if ($released) {
                    // get pageId correctly
                    $pageInfo = $this->project->getXmlNav()->getPageInfo($this->docRef);
                    $pageDoc = $this->xmldb->getDoc("pages");
                    $deltaUpdates = new \Depage\WebSocket\JsTree\DeltaUpdates($prefix, $this->pdo, $this->xmldb, $pageDoc->getDocId(), $this->project, 0);
                    $parentId = $pageDoc->getParentIdById($pageInfo->pageId);
                    $deltaUpdates->recordChange($parentId);
                }
            }

            $this->form->clearSession(false);
            $this->clearOldFormData();

            return new \Depage\Json\Json(["success" => true, "changed" => $changed]);
        }

        $h .= $this->form;
        //$h .= htmlentities($xml->saveXML($node));

        $output = new Html([
            'title' => "edit",
            'content' => $h,
        ], $this->htmlOptions);

        return $output;
    }
    // }}}

    // {{{ thumbnail()
    /**
     * @brief thumbnail
     *
     * @param mixed $file
     * @return void
     **/
    public function thumbnail($file)
    {
        if ($_GET['ajax'] == "true") {
            $file = rawurldecode($file);
        }
        $file = $this->fl->getFileInfoByRef($file);

        return new Html("thumbnail.tpl", [
            'file' => $file,
            'project' => $this->project,
        ], $this->htmlOptions);
    }
    // }}}

    // {{{ getCallbackForNode()
    /**
     * @brief getCallbackForNode
     *
     * @param mixed $node
     * @return void
     **/
    protected function getCallbackForNode($node, $prefix)
    {
        $f = str_replace(":", "_", $node->nodeName);
        $parts = explode("_", $f);

        for ($i = 0; $i < count($parts); $i++) {
            $parts[$i] = ucfirst($parts[$i]);
        }
        $callback = $prefix . implode($parts);

        if ($callback == "addEditPlainSource" && $this->nodeId != $node->getAttribute("db:id")) {
            return false;
        }

        if (is_callable([$this, $callback])) {
            return $callback;
        }

        if ($node->prefix != "sec" && $node->prefix != "proj") {
            //echo $callback . "<br>";
        }

        return false;
    }
    // }}}
    // {{{ getLabelForNode()
    /**
     * @brief getLabelForNode
     *
     * @param mixed $node
     * @return void
     **/
    protected function getLabelForNode($node, $fallback = "")
    {
        if (false) {
            _("prop_name_edit_img_caption");
            _("prop_name_edit_img_copyright");
            _("prop_name_edit_img_thumb");
        }

        $label = $node->getAttribute("name");
        if (empty($label)) {
            $label = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "name");
            if (!empty($label)) {

                $label = _($label);
            }
        }
        if (empty($label)) {
            $label = $fallback;
        }

        return $label;
    }
    // }}}
    // {{{ getLangFieldset()
    /**
     * @brief getLangFieldset
     *
     * @param mixed $node, $label
     * @return void
     **/
    protected function getLangFieldset($node, $label, $class = "")
    {
        $lang = $node->getAttribute("lang");

        if ($lang == $this->languages[0] || $lang == "") {
            $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

            $this->fs = $this->form->addFieldset("xmledit-$nodeId-lang-fs", [
                'label' => $label,
                'class' => "doc-property-fieldset lang-fieldset $class",
            ]);
        }

        return $this->fs;
    }
    // }}}
    // {{{ getForceSize()
    /**
     * @brief getForceSize
     *
     * @param mixed $node
     * @return void
     **/
    protected function getForceSize($node)
    {
        $forceSize = $node->getAttribute("force_size");
        $forceWidth = $node->getAttribute("force_width") ?? "X";
        $forceHeight = $node->getAttribute("force_height") ?? "X";

        if (empty($forceSize)) {
            $forceSize = $forceWidth . "x" . $forceHeight;
        }
        if ($forceSize == "XxX") {
            $forceSize = "";
        }

        return $forceSize;
    }
    // }}}

    // {{{ addPgRelease()
    /**
     * @brief addPgRelease
     *
     * @param mixed $node
     * @return void
     **/
    protected function addPgRelease($currentNode)
    {
        $pageInfo = $this->project->getXmlNav()->getPageInfo($this->docRef);
        if (!$pageInfo) {
            return;
        }
        $lastchangeUser = \Depage\Auth\User::loadById($this->pdo, $pageInfo->lastchangeUid);
        $dateFormatter = new \Depage\Formatters\DateNatural();

        list($lang) = array_keys($this->project->getLanguages());
        $lastPublishDate = $this->project->getLastPublishDate();
        $lastPublishDateOf = $this->project->getLastPublishDateOf($lang . $pageInfo->url);

        if (!$lastPublishDateOf) {
            $pageInfo->published = false;
        }

        $hasUnpublishedChanges = false;
        if ($pageInfo->lastrelease) {
            $hasUnpublishedChanges = $lastPublishDate->getTimestamp() <= $pageInfo->lastrelease->getTimestamp();
        }

        $fs = $this->form->addFieldset("xmledit-{$this->docRef}-lastchange-fs", [
            'label' => _("Page Status"),
            'class' => "doc-property-fieldset doc-property-meta " . ($currentNode->prefix == 'pg' ? "open" : ""),
            'dataAttr' => [
                'docref' => $this->docRef,
                'protected' => $pageInfo->protected,
            ],
        ]);

        if ($pageInfo->type == "Depage\\Cms\\XmlDocTypes\\Page") {
            // {{{ add published/release status
            $target = $this->project->getDefaultTargetUrl() . "/" . $this->project->getDefaultLanguage();

            $url = $target . $pageInfo->url;
            $icon = "";
            $message = "";

            if ($pageInfo->published) {
                $icon .= "<i class=\"icon icon-published\" data-tooltip=\"" . _("Page is published") . "\"></i>";
            }
            if ($hasUnpublishedChanges) {
                $icon .= "<i class=\"icon icon-unpublished\" data-tooltip=\"" . _("Page is waiting to be published") . "\"></i>";
            }
            if (!$pageInfo->released) {
                $icon .= "<i class=\"icon icon-unreleased\" data-tooltip=\"" . _("Page has unreleased changes") . "\"></i>";
            }
            if ($pageInfo->published && !$pageInfo->released) {
                $message = _("Page is published but has unreleased changes.");
            } else if ($hasUnpublishedChanges) {
                $message = _("Page is waiting to be published.");
            } else if ($pageInfo->published) {
                $message = _("Page is published.");
            } else if (!$pageInfo->released) {
                $message = _("Page has not been published yet.");
            }

            if ($pageInfo->published) {
                $fs->addHtml(sprintf(
                    _("<p class=\"status\">%s<span><a href=\"%s\" target=\"_blank\">%s</a></span></p>"),
                    $icon,
                    htmlspecialchars($url),
                    htmlspecialchars($message)
                ));
            } else {
                $fs->addHtml(sprintf(
                    _("<p class=\"status\">%s<span>%s</span></p>"),
                    $icon,
                    htmlspecialchars($message)
                ));
            }
            // }}}

            $fs->addHtml("<div class=\"details\">");
            // {{{ add changed date
            $fs->addHtml(sprintf(
                _("<p class=\"date\">%s %s by %s</p>"),
                _("Changed"),
                $dateFormatter->format($pageInfo->lastchange, true),
                htmlspecialchars($lastchangeUser->fullname ?? _("unknown user"))
            ));
            // }}}
            // {{{ add url input
            $fs->addUrl("url-{$this->docRef}", [
                'label' => _("url"),
                'readonly' => true,
                'defaultValue' => $url,
            ]);
            // }}}
            // {{{ add restore from history interface
            if ($this->authUser->canEditTemplates()) {
                $history = $this->doc->getHistory();
                $list = [
                    '' => _("Earlier page versions"),
                    'pre' => _("Current Version"),
                ];

                foreach ($history->getVersions() as $timestamp => $version) {
                    $list["history-" . $version->lastsaved->format("Y-m-d-H:i:s")] = $version->lastsaved->format("Y-m-d H:i:s");
                }

                if (count($list) > 0) {
                    $fs->addSingle("pageVersions", [
                        'label' => _("Earlier page versions"),
                        'skin' => 'select',
                        'list' => $list,
                        'class' => "page-versions",
                    ]);
                }
            }
            // }}}
            $fs->addHtml("</div>");

            // {{{ add release button
            if ($this->authUser->canDirectlyReleasePages()) {
                $releaseTitle = _("Release Page");
                $releaseHover = _("Mark this page to be published, when project gets published next time");
            } else {
                $releaseTitle = _("Request Release");
                $releaseHover = _("Ask for this page the be released");
            }
            $class = $pageInfo->released ? "disabled" : "";
            $fs->addHtml("<p class=\"release\"><a class=\"button $class\" data-tooltip=\"$releaseHover\">{$releaseTitle}</a></p>");
            // }}}
        }
    }
    // }}}
    // {{{ addPgMeta()
    /**
     * @brief addPgMeta
     *
     * @param mixed $node
     * @return void
     **/
    protected function addPgMeta($node)
    {
        $pageInfo = $this->project->getXmlNav()->getPageInfo($this->docRef);
        if (!$pageInfo) {
            return;
        }
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        if ($pageInfo->type == "Depage\\Cms\\XmlDocTypes\\Page") {
            $list = ['' => _("Default")] + $this->project->getColorschemes();
            $fs = $this->form->addFieldset("xmledit-$nodeId-colorscheme-fs", [
                'label' => _("Colorscheme"),
                'class' => "doc-property-fieldset",
            ]);
            $fs->addSingle("colorscheme-$nodeId", [
                'label' => "",
                'list' => $list,
                'skin' => "select",
                'dataPath' => "//*[@db:id = '$nodeId']/@colorscheme",
            ]);
        }

        $navs = $this->project->getNavigations();
        $defaults = [];
        foreach ($navs as $key => $val) {
            if (($pageInfo->nav[$key] ?? false) == 'true') {
                $defaults[] = $key;
            }
        }
        $fs = $this->form->addFieldset("xmledit-$nodeId-navigation-fs", [
            'label' => _("Navigation"),
            'class' => "doc-property-fieldset",
        ]);
        $fs->addMultiple("xmledit-$nodeId-navigation", [
            'label' => "",
            'list' => $navs,
            'class' => 'page-navigations',
            'defaultValue' => $defaults,
            'dataAttr' => [
                'pageId' => $pageInfo->pageId,
            ],
        ]);

        $tags = $this->project->getTags();
        $defaults = [];
        foreach ($tags as $key => $val) {
            if (($pageInfo->tags[$key] ?? false) == 'true') {
                $defaults[] = $key;
            }
        }
        if (count($tags) > 0) {
            $fs = $this->form->addFieldset("xmledit-$nodeId-tags-fs", [
                'label' => _("Tags"),
                'class' => "doc-property-fieldset",
            ]);
            $fs->addMultiple("xmledit-$nodeId-tags", [
                'label' => "",
                'list' => $tags,
                'class' => 'page-tags',
                'defaultValue' => $defaults,
                'dataAttr' => [
                    'pageId' => $pageInfo->pageId,
                ],
            ]);
        }

        if ($this->authUser->canProtectPages()) {
            $fs = $this->form->addFieldset("xmledit-$nodeId-protected-fs", [
                'label' => _("Protection"),
                'class' => "doc-property-fieldset",
            ]);
            $fs->addMultiple("xmledit-$nodeId-protected", [
                'label' => "",
                'class' => 'page-protected',
                'class' => 'page-protection',
                'defaultValue' => $pageInfo->protected ? ['protected'] : [],
                'list' => [
                    'protected' => _("Page protected"),
                ],
                'dataAttr' => [
                    'pageId' => $pageInfo->pageId,
                ],
            ]);
        } else if ($pageInfo->protected) {
            $fs = $this->form->addFieldset("xmledit-$nodeId-protected-fs", [
                'label' => _("Protection"),
                'class' => "doc-property-fieldset",
            ]);
            $fs->addHtml("<p>" . _("Page is protected and cannot be changed.") . "</p>");
        }
        if ($pageInfo->type == "Depage\\Cms\\XmlDocTypes\\Page") {
            $fs = $this->form->addFieldset("xmledit-$nodeId-pagetype-fs", [
                'label' => _("Pagetype"),
                'class' => "doc-property-fieldset",
            ]);
            $fs->addSingle("xmledit-$nodeId-pagetype", [
                'label' => "",
                'skin' => "select",
                'class' => 'page-type',
                'list' => [
                    'html' => _("html"),
                    'text' => _("text"),
                    'php' => _("php"),
                ],
                'defaultValue' => $pageInfo->fileType,
                'dataAttr' => [
                    'pageId' => $pageInfo->pageId,
                ],
            ]);
        }
    }
    // }}}
    // {{{ addPgTitle()
    /**
     * @brief addPgTitle
     *
     * @param mixed $node
     * @return void
     **/
    protected function addPgTitle($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Title")));
        $fs->addText("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addPgLinkdesc()
    /**
     * @brief addPgLinkdesc
     *
     * @param mixed $node
     * @return void
     **/
    protected function addPgLinkdesc($node)
    {
        $title = _("Linkinfo");
        if ($this->doc->getDocInfo()->type == "Depage\\Cms\\XmlDocTypes\\Newsletter") {
            $title = _("Subject");
        }
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, $title));
        $fs->addText("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addPgDesc()
    /**
     * @brief addPgDesc
     *
     * @param mixed $
     * @return void
     **/
    protected function addPgDesc($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Description")));
        $fs->addRichtext("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']",
            'autogrow' => true,
            'allowedTags' => [
                "p",
                "br",
            ],
        ]);
    }
    // }}}

    // {{{ addEditTextSingleline()
    /**
     * @brief addEditTextSingleline
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditTextSingleline($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Text")));
        $fs->addText("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditTextHeadline()
    /**
     * @brief addEditTextHeadline
     *
     * @param mixed $
     * @return void
     **/
    protected function addEditTextHeadline($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Headline")));

        $fs->addRichtext("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']",
            'lang' => $node->getAttribute("lang"),
            'autogrow' => true,
            'allowedTags' => [
                "p",
                "br",
            ],
        ]);
    }
    // }}}
    // {{{ addEditTextFormatted()
    /**
     * @brief addEditTextFormatted
     *
     * @param mixed $
     * @return void
     **/
    protected function addEditTextFormatted($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Text")));

        // @todo add lang attribute for spelling hint
        $fs->addRichtext("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'autogrow' => true,
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']",
            'allowedTags' => [
                // inline elements
                "a",
                "b",
                "strong",
                "i",
                "em",
                "small",

                // block elements
                "p",
                "br",
                "ul",
                "ol",
                "li",
            ],
        ]);
    }
    // }}}
    // {{{ addEditRichtext()
    /**
     * @brief addEditRichtext
     *
     * @param mixed $
     * @return void
     **/
    protected function addEditRichtext($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Text")));

        // @todo add lang attribute for spelling hint
        $fs->addRichtext("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'autogrow' => true,
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']",
            'allowedTags' => [
                // inline elements
                "a",
                "b",
                "strong",
                "i",
                "em",
                "small",

                // block elements
                "p",
                "br",
                "h1",
                "h2",
                "ul",
                "ol",
                "li",
            ],
        ]);
    }
    // }}}
    // {{{ addEditNumber()
    /**
     * @brief addEditNumber
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditNumber($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Text")));
        $fs->addNumber("xmledit-$nodeId", [
            'label' => $node->getAttribute("unit"),
            'step' => $node->getAttribute("step") != '' ? $node->getAttribute("step") : null,
            'min' => $node->getAttribute("min") != '' ? $node->getAttribute("min") : null,
            'max' => $node->getAttribute("max") != '' ? $node->getAttribute("max") : null,
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditType()
    /**
     * @brief addEditType
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditType($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");
        $options = $node->getAttribute("options");
        $variables = $this->project->getVariables();

        $options = preg_replace_callback("/%var_([^%]*)%/", function($matches) use ($variables) {
            return $variables[$matches[1]];
        }, $options);

        $list = [];
        foreach (explode(",", $options) as $val) {
            $list[$val] = $val;
        }

        $class = "edit-type";
        $skin = "radio";

        if (count($list) > 6) {
            $class = "";
            $skin = "select";
        }

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Type")));
        $fs->addSingle("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'list' => $list,
            'class' => $class,
            'skin' => $skin,
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditDate()
    /**
     * @brief addEditDate
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditDate($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Date")));
        $fs->addDate("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditTime()
    /**
     * @brief addEditTime
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditTime($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        if (!$node->hasAttribute("value")) {
            $node->setAttribute("value", "");
        }

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Time")));
        $fs->addText("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditColor()
    /**
     * @brief addEditColor
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditColor($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        if (!$node->hasAttribute("value")) {
            $node->setAttribute("value", "");
        }

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Color")));
        $fs->addColor("xmledit-$nodeId", [
            'label' => "",
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addEditColorscheme()
    /**
     * @brief addEditColor
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditColorscheme($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        if (!$node->hasAttribute("value")) {
            $node->setAttribute("value", "");
        }

        $list = ['' => _("Default")] + $this->project->getColorschemes();
        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Colorscheme")));
        $fs->addSingle("colorscheme-$nodeId", [
            'label' => "",
            'list' => $list,
            'skin' => "select",
            'dataPath' => "//*[@db:id = '$nodeId']/@colorscheme",
        ]);
    }
    // }}}
    // {{{ addEditA()
    /**
     * @brief addEditA
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditA($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");
        $lang = $node->getAttribute("lang");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Link")), "edit-a");

        $fs->addText("xmledit-$nodeId-title", [
            'label' => !empty($lang) ? $lang : _("Title"),
            'placeholder' => _("Link title"),
            'dataPath' => "//*[@db:id = '$nodeId']",
        ]);

        // @todo leave only one target setting for multiple links
        $fs->addSingle("xmledit-$nodeId-target", [
            'label' => $this->getLabelForNode($node, _("Target")),
            'list' => [
                '' => _("Default"),
                '_blank' => _("New Window"),
            ],
            'skin' => "radio",
            'class' => "edit-type edit-target",
            'dataPath' => "//*[@db:id = '$nodeId']/@target",
        ]);

        $fs->addText("xmledit-$nodeId-href", [
            'label' => _("href"),
            'class' => "edit-href",
            'placeholder' => _("http://domain.com"),
            'dataPath' => "//*[@db:id = '$nodeId']/@href",
        ]);

    }
    // }}}
    // {{{ addEditAudio()
    /**
     * @brief addEditAudio
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditAudio($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->form->addFieldset("xmledit-$nodeId", [
            'label' => $this->getLabelForNode($node, _("Audio")),
            'class' => "doc-property-fieldset edit-audio",
        ]);
        $fs->addText("xmledit-$nodeId-src", [
            'label' => $this->getLabelForNode($node, _("src")),
            'class' => "edit-src",
            'dataAttr' => [
                'accept' => ".mp3,.m4a,.ogg,.wav,.flac",
            ],
            'dataPath' => "//*[@db:id = '$nodeId']/@src",
        ]);
    }
    // }}}
    // {{{ addEditVideo()
    /**
     * @brief addEditVideo
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditVideo($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $f = $this->form->addFieldset("xmledit-$nodeId", [
            'label' => $this->getLabelForNode($node, _("Video")),
            'class' => "edit-video",
        ]);
        $f->addText("xmledit-$nodeId-src", [
            'label' => $this->getLabelForNode($node, _("src")),
            'class' => "edit-src",
            'dataAttr' => [
                'accept' => ".mp4,.m4v,.ogv,.webm",
            ],
            'dataPath' => "//*[@db:id = '$nodeId']/@src",
        ]);
    }
    // }}}
    // {{{ addEditImg()
    /**
     * @brief addEditImg
     *
     * @param mixed $node
     * @return void
     **/
    protected function addEditImg($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Image")), "edit-img");

        $fs->addHtml($this->thumbnail($node->getAttribute("src")));


        $lang = $node->getAttribute("lang");
        $fs->addText("xmledit-$nodeId-img", [
            'label' => !empty($lang) ? $lang : _("src"),
            'class' => "edit-src",
            'dataAttr' => [
                'accept' => ".jpg,.jpeg,.png,.gif,.svg,.pdf",
                'forceSize' => $this->getForceSize($node),
            ],
            'dataPath' => "//*[@db:id = '$nodeId']/@src",
        ]);

        $fs->addText("xmledit-$nodeId-title", [
            'label' => _("title"),
            'placeholder' => _("Image title"),
            'dataPath' => "//*[@db:id = '$nodeId']/@title",
        ]);

        $fs->addText("xmledit-$nodeId-alt", [
            'label' => _("alt"),
            'placeholder' => _("Image description"),
            'dataPath' => "//*[@db:id = '$nodeId']/@alt",
        ]);
        if ($node->hasAttribute("href") || $node->hasAttribute("href_id")) {
            $fs->addText("xmledit-$nodeId-href", [
                'label' => _("href"),
                'class' => "edit-href",
                'placeholder' => _("http://domain.com"),
                'dataPath' => "//*[@db:id = '$nodeId']/@href",
            ]);
        }
    }
    // }}}
    // {{{ addEditTable()
    /**
     * @brief addEditTable
     *
     * @param mixed $param
     * @return void
     **/
    protected function addEditTable($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Table")));
        $fs->addRichtext("xmledit-$nodeId", [
            'label' => $node->getAttribute("lang"),
            'lang' => $node->getAttribute("lang"),
            'dataPath' => "//*[@db:id = '$nodeId']",
            'class' => "edit-table",
            'lang' => $node->getAttribute("lang"),
            'autogrow' => true,
            'allowedTags' => [
                "table",
                "tbody",
                "tr",
                "td",
                "p",
                "br",
                "b",
                "strong",
                "i",
                "em",
                "small",
                "a",
            ],
        ]);
    }
    // }}}
    // {{{ addEditPlainSource()
    /**
     * @brief addEditPlainSource
     *
     * @param mixed $param
     * @return void
     **/
    protected function addEditPlainSource($node)
    {
        if (!$this->authUser->canEditTemplates()) {
            return $this->addNotAllowed();
        }
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $fs = $this->getLangFieldset($node, $this->getLabelForNode($node, _("Source")));

        $fs->addTextarea("xmledit-$nodeId", [
            'label' => "",
            'dataPath' => "//*[@db:id = '$nodeId']",
            'autogrow' => true,
            'class' => "edit-source"
        ]);
    }
    // }}}
    // {{{ addNotAllowed()
    /**
     * @brief addNotAllowed
     *
     * @return void
     **/
    protected function addNotAllowed()
    {
        $this->form->addHtml("<p class=\"error\">");
            $this->form->addHtml(htmlentities(_("Not allowed to edit this element.")));
        $this->form->addHtml("</p>");
    }
    // }}}
    // {{{ addColor()
    /**
     * @brief addColor
     *
     * @param mixed
     * @return void
     **/
    protected function addColor($node)
    {
        $nodeId = $node->getAttributeNs("http://cms.depagecms.net/ns/database", "id");

        $this->form->addText("xmledit-$nodeId", [
            'label' => $node->getAttribute("name"),
            'dataPath' => "//*[@db:id = '$nodeId']/@value",
        ]);
    }
    // }}}
    // {{{ addSecAutoNewsList()
    /**
     * @brief addSecAutoNewsList
     *
     * @param mixed $param
     * @return void
     **/
    protected function addSecAutoNewsList($node)
    {
        $this->newsletter = \Depage\Cms\Newsletter::loadByName($this->pdo, $this->project, $this->docRef);
        $this->newsletterCandidates = $this->newsletter->getCandidates();

        $pages = $this->newsletter->getNewsletterPages();
        //var_dump($pages);

        $count = 0;
        $this->form->addHtml("<div class=\"info\"><p>" . _("Please choose the news items you want to include in the newsletter:") . "</p></div>");
        $fs = $this->form->addFieldset("unsentItems", [
            'label' => _("Unsent news items"),
            'class' => "doc-property-fieldset",
        ]);
        $fs->addHtml("<div class=\"scrollable-content\">");
        foreach ($this->newsletterCandidates as $c) {
            if (!$c->alreadyUsed) {
                $count++;
                $nodes = $this->form->dataNodeXpath->query("//sec:news[@db:docref='{$c->name}']");
                $fs->addBoolean("{$c->name}", [
                    'label' => $c->url,
                    'defaultValue' => in_array($c->name, $pages),
                ]);
            }
        }
        if ($count == 0) {
            $fs->addHtml("<p>" . _("No news items available.") . "</p>");
        }
        $fs->addHtml("</div>");

        $count = 0;
        $fs = $this->form->addFieldset("sentItems", [
            'label' => _("News items included in other newsletters"),
            'class' => "detail doc-property-fieldset",
        ]);
        $fs->addHtml("<div class=\"scrollable-content\">");
        foreach ($this->newsletterCandidates as $c) {
            if ($c->alreadyUsed) {
                $count++;
                $fs->addBoolean("{$c->name}", [
                    'label' => $c->url,
                    'defaultValue' => in_array($c->name, $pages),
                ]);
            }
        }
        if ($count == 0) {
            $fs->addHtml("<p>" . _("No news items available.") . "</p>");
        }
        $fs->addHtml("</div>");
    }
    // }}}
    // {{{ saveSecAutoNewsList()
    /**
     * @brief saveSecAutoNewsList
     *
     * @param mixed $param
     * @return void
     **/
    protected function saveSecAutoNewsList($node)
    {
        $values = $this->form->getValues();
        $pages = [];
        foreach ($this->newsletterCandidates as $c) {
            if ($values[$c->name]) {
                $pages[] = $c;
            }
        }
        $this->newsletter->setNewsletterPages($pages, $xml);

        return true;
    }
    // }}}

    // {{{ clearOldFormData()
    /**
     * @brief clearOldFormData
     *
     * @param mixed
     * @return void
     **/
    protected function clearOldFormData()
    {
        foreach ($_SESSION as $key => $val) {
            if (substr($key, 0, 17) != "htmlform-xmldata_") continue;

            $timestamp = time();
            $ttl = 60 * 60; // 60 minutes
            if (
                isset($val['formTimestamp'])
                && ($timestamp - $val['formTimestamp'] > $ttl)
            ) {
                unset($_SESSION[$key]);
            }
        }
    }
    // }}}
}
/* vim:set ft=php sts=4 fdm=marker et : */
