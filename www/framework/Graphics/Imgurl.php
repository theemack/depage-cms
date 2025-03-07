<?php

namespace Depage\Graphics;

/*
 * @todo test to stay inside 3MP as maximum image size for safety reasons and
 * to be able to support all iOS devices:
 * http://www.williammalone.com/articles/html5-javascript-ios-maximum-image-size/
 */

class Imgurl
{
    protected $options = array();
    protected $actions = array();
    protected $notFound = false;
    public $id = "";
    public $rendered = false;
    protected $invalidAction = false;
    protected $cachePath = '';
    /*
     * action aliases
     *
     * Note that the order is important so shoter action names should
     * come after larger ones
     */
    protected $aliases = array(
        'quality'    => "setQuality",
        'q'          => "setQuality",
        'crop'       => "addCrop",
        'c'          => "addCrop",
        'resize'     => "addResize",
        'r'          => "addResize",
        'thumbfill'  => "addThumbfill",
        'tf'         => "addThumbfill",
        'thumb'      => "addThumb",
        't'          => "addThumb",
        'background' => "addBackground",
        'bg'         => "addBackground",
    );

    // {{{ constructor
    /*
     * @param $options hold the same options as the graphics class
     */
    public function __construct($options = array())
    {
        $this->options = $options;
    }
    // }}}

    // {{{ analyze
    /*
     * Analyzes the image url and set the path for srcImg and outImg
     */
    protected function analyze($url)
    {
        $this->invalidAction = false;
        $this->notFound = false;
        $this->rendered = false;
        $this->id = "";
        $this->actions = [];

        if (isset($this->options['baseUrl']) && isset($this->options['cachePath'])) {
            $baseUrl = rtrim($this->options['baseUrl'], '/');
            $this->cachePath = $this->options['cachePath'];
            $relativePath = $this->options['relPath'] ?? '';
        } else if (defined('DEPAGE_PATH') && defined('DEPAGE_CACHE_PATH')) {
            // we are using depage-framework so use constants for paths
            $info = parse_url(DEPAGE_BASE);
            $baseUrl = rtrim($info['path'], '/');
            $relativePath = "";
            $this->cachePath = \DEPAGE_CACHE_PATH . "graphics/";
        } else {
            // we using the library plainly -> get path through url
            $scriptParts = explode("/", $_SERVER["SCRIPT_NAME"]);
            $uriParts = explode("/", $_SERVER["REQUEST_URI"]);

            if (strpos($_SERVER["SCRIPT_NAME"], "/lib/") !== false) {
                for ($i = 0; $i < count($uriParts); $i++) {
                    // find common parts of url up to lib parameter
                    if ($uriParts[$i] == "lib") {
                        break;
                    }
                }
            } else {
                for ($i = 0; $i < count($uriParts); $i++) {
                    // find common parts of url up to lib parameter
                    if ($scriptParts[$i] != $uriParts[$i]) {
                        break;
                    }
                }
            }
            $baseUrl = implode("/", array_slice($uriParts, 0, $i));
            if (isset($this->options['relPath'])) {
                $relativePath = $this->options['relPath'];
            } else {
                $relativePath = str_repeat("../", count($scriptParts) - $i - 1);
            }
            $this->cachePath = $relativePath . "lib/cache/graphics/";
        }
        $baseUrlStatic = $baseUrl;
        if (isset($this->options['baseUrlStatic'])) {
            $baseUrlStatic = rtrim($this->options['baseUrlStatic'], '/');
        }

        // get image name
        $imgUrl = $url;
        if ($baseUrl == "") {
            $imgUrl = substr($url, 1);
        } else if (strpos($url, $baseUrlStatic) === 0) {
            $imgUrl = substr($url, strlen($baseUrlStatic) + 1);
        } else if (strpos($url, $baseUrl) === 0) {
            $imgUrl = substr($url, strlen($baseUrl) + 1);
        }

        // get action parameters
        $success = preg_match("/(.*\.(jpg|jpeg|gif|png|webp|eps|tif|tiff|pdf|svg))\.([^\\\]*)\.(jpg|jpeg|gif|png|webp)/i", $imgUrl, $matches);

        if (!$success) {
            $this->invalidAction = true;

            return;
        }

        $this->id = rawurldecode($matches[0]);
        $this->srcImg = $relativePath . rawurldecode($matches[1]);
        $this->outImg = $this->cachePath . rawurldecode($matches[0]);
        $this->actions = $this->analyzeActions($matches[3]);
    }
    // }}}
    // {{{ analyzeActions
    /*
     * Analyzes actions and replaces shortcuts with real actions
     */
    protected function analyzeActions($actionString)
    {
        $actions = explode(".", $actionString);

        foreach ($actions as &$action) {
            $regex = implode("|", array_keys($this->aliases));
            preg_match("/^($regex)/i", $action, $matches);

            if (isset($matches[1]) && isset($this->aliases[$matches[1]])) {
                $func = $this->aliases[$matches[1]];
                $params = substr($action, strlen($matches[1]));
            } else {
                $func = "";
                $params = "";
            }

            if (!empty($func)) {
                $params = preg_split("/[-x,]+/", $params, null, PREG_SPLIT_NO_EMPTY);

                if ($func == "addBackground") {
                    if (!in_array($params[0], array("transparent", "checkerboard"))) {
                        $params[0] = "#{$params[0]}";
                    }
                } else {
                    foreach ($params as $i => &$p) {
                        $p = intval($p);
                        if ($p == 0 && $i < 2) {
                            $p = null;
                        }
                    }
                }

                $this->actions[] = array($func, $params);
            } else {
                $this->invalidAction = true;
            }
        }

        return $this->actions;
    }
    // }}}
    // {{{ render
    public function render($url = null)
    {
        if (is_null($url)) {
            $url = $_SERVER["REQUEST_URI"];
        }
        $this->analyze($url);

        if ($this->invalidAction) {
            return $this;
        }
        // make cache diretories
        $outDir = dirname($this->outImg);
        if (!is_dir($outDir)) {
            mkdir($outDir, 0755, true);
        }
        if (file_exists($this->outImg) && filemtime($this->outImg) >= filemtime($this->srcImg)) {
            // rendered image does exist already
            return $this;
        }

        try {
            $graphics = Graphics::factory($this->options);

            // add actions to graphics class
            foreach ($this->actions as $action) {
                list($func, $params) = $action;
                if (is_callable(array($graphics, $func))) {
                    call_user_func_array(array($graphics, $func), $params);
                }
            }

            // render image out
            $graphics->render($this->srcImg, $this->outImg);

            $this->rendered = true;
        } catch (Exceptions\FileNotFound $e) {
            $this->notFound = true;
            return $this;
        } catch (Exceptions\Exception $e) {
            $this->invalidAction = true;
        }

        return $this;
    }
    // }}}

    // {{{ display()
    public function display()
    {
        $info = pathinfo($this->outImg);
        $ext = strtolower($info['extension']);

        if ($this->invalidAction) {
            header("HTTP/1.1 500 Internal Server Error");
            echo("invalid image action");
            die();
        }
        if ($this->notFound) {
            header("HTTP/1.1 404 Not Found");
            echo("file not found");
            die();
        }

        if ($ext == "jpg" || $ext ==  "jpeg") {
            header("Content-type: image/jpeg");
        } elseif ($ext == "png") {
            header("Content-type: image/png");
        } elseif ($ext == "gif") {
            header("Content-type: image/gif");
        } elseif ($ext == "webp") {
            header("Content-type: image/webp");
        }
        readfile($this->outImg);

        return $this;
    }
    // }}}

    // {{{ getUrl()
    public function getUrl($img)
    {
        $info = pathinfo($img);
        $ext = $info['extension'];

        if (count($this->actions) > 0) {
            return $img . "." . implode(".", $this->actions) . "." . $ext;
        } else {
            return $img;
        }
    }
    // }}}

    // {{{ addBackground()
    public function addBackground($background)
    {
        $this->actions[] = "bg{$background}";

        return $this;
    }
    // }}}
    // {{{ addCrop()
    public function addCrop($width, $height, $x = 0, $y = 0)
    {
        $this->actions[] = "crop{$width}x{$height}-{$x}x{$y}";

        return $this;
    }
    // }}}
    // {{{ addResize()
    public function addResize($width, $height)
    {
        $this->actions[] = "r{$width}x{$height}";

        return $this;
    }
    // }}}
    // {{{ addThumb()
    public function addThumb($width, $height)
    {
        $this->actions[] = "t{$width}x{$height}";

        return $this;
    }
    // }}}
    // {{{ addThumbfill()
    public function addThumbfill($width, $height, $centerX = 50, $centerY = 50)
    {
        $action = "tf{$width}x{$height}";
        if ($centerX != 50 || $centerY != 50) {
            $action .= "-{$centerX}x{$centerY}";
        }

        $this->actions[] = $action;

        return $this;
    }
    // }}}
    // {{{ setQuality()
    public function setQuality($quality)
    {
        $this->actions[] = "q{$quality}";

        return $this;
    }
    // }}}
}
/* vim:set ft=php sw=4 sts=4 fdm=marker et : */
