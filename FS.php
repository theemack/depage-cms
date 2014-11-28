<?php

namespace Depage\FS;

class FS
{
    // {{{ variables
        protected $currentPath;
        protected $base;
        protected $url;
        protected $hidden = false;
    // }}}
    // {{{ constructor
    public function __construct($url, $params = array())
    {
        $parsed = $this->parseUrl($url);
        $path = isset($parsed['path']) ? $parsed['path'] : '';
        unset($parsed['path']);

        $this->url = $parsed;
        if (isset($params['scheme']))   $this->url['scheme']    = $params['scheme'];
        if (isset($params['user']))     $this->url['user']      = $params['user'];
        if (isset($params['pass']))     $this->url['pass']      = $params['pass'];
        if (isset($params['host']))     $this->url['host']      = $params['host'];
        if (isset($params['port']))     $this->url['port']      = $params['port'];
        if (isset($params['hidden']))   $this->hidden           = $params['hidden'];

        if (!isset($this->url['scheme'])) {
            $this->url['scheme'] = 'file';
            // @todo handle failed realpath
            $path = realpath($path);
        }

        $cleanPath = $this->cleanPath($path);
        $this->base = (substr($cleanPath, -1) == '/') ? $cleanPath : $cleanPath . '/';
    }
    // }}}

    // {{{ pwd
    public function pwd()
    {
        $url = $this->url;
        $url['path'] = $this->base . $this->currentPath;

        return $this->buildUrl($url);
    }
    // }}}
    // {{{ ls
    public function ls($url)
    {
        $cleanUrl = $this->cleanUrl($url);
        $path = str_replace($this->pwd(), '', $cleanUrl);

        return $this->lsRecursive($path, '');
    }
    // }}}
    // {{{ lsDir
    public function lsDir($path = '')
    {
        return $this->lsFilter($path, 'is_dir');
    }
    // }}}
    // {{{ lsFiles
    public function lsFiles($path = '')
    {
        return $this->lsFilter($path, 'is_file');
    }
    // }}}
    // {{{ cd
    /**
     * Changes current directory
     *
     * @public
     *
     * @param $path (string) path of directory to change to
     */
    public function cd($url)
    {
        $cleanUrl = $this->cleanUrl($url);

        if (is_dir($cleanUrl) && is_readable($cleanUrl . '/.')) {
            $this->currentPath = str_replace($this->pwd(), '', $cleanUrl) . '/';
        } else {
            $path = $this->parseUrl($cleanUrl)['path'];
            throw new Exceptions\FSException('Directory not accessible ' . $path);
        }
    }
    // }}}
    // {{{ mkdir
    /**
     * Creates new directory recursive if it doesn't exist
     *
     * @public
     *
     * @param $path (string) path of new directory
     */
    public function mkdir($url)
    {
        $cleanUrl = $this->cleanUrl($url);
        return mkdir($cleanUrl, 0777, true);
    }
    // }}}
    // {{{ rm
    /**
     * Removes files and directories recursive
     *
     * @public
     *
     * @param $path (string) path to file or directory
     *
     * @return $success (bool) true on success, false on error
     */
    public function rm($url)
    {
        $cleanUrl = $this->cleanUrl($url);

        if (
            $cleanUrl == $this->pwd()
            || $cleanUrl . '/' == $this->pwd()
        ) {
            throw new Exceptions\FSException('Cannot delete current directory ' . $this->pwd());
        }

        $success = false;

        if (is_dir($cleanUrl)) {
            foreach ($this->scanDir($cleanUrl, true) as $nested) {
                $this->rm($cleanUrl . '/' .  $nested);
            }

            // workaround, rmdir does not support file stream wrappers
            if ($this->url['scheme'] == 'file') {
                $cleanUrl = preg_replace(';^file://;', '', $cleanUrl);
            }

            $success = rmdir($cleanUrl);
        } else if (is_file($cleanUrl)) {
            $success = unlink($cleanUrl);
        }

        return $success;
    }
    // }}}
    // {{{ mv
    /**
     * Renames or moves file or directory
     *
     * @public
     *
     * @param    $source (string) name of source file or directory
     * @param    $target (string) target
     *
     * @return    $success (bool) true on success, false on error
     */
    public function mv($sourcePath, $targetPath)
    {
        $source = $this->cleanUrl($sourcePath);
        $target = $this->cleanUrl($targetPath);

        if (file_exists($source)) {
            if (!($value = rename($source, $target))) {
                throw new Exceptions\FSException("could not move '$source' to '$target'");
            }
            return $value;
        } else {
            throw new Exceptions\FSException("could not move '$source' to '$target' - source doesn't exist");
        }
    }
    // }}}
    // {{{ get
    /**
     * Writes content of a local file to targetfile
     *
     * @public
     *
     * @param    $filepath (string) name of targetfile
     * @param    $sourcefile (string) path to sourcefile
     *
     * @return    $success (bool) true on success, false on error
     */
    public function get($remotePath, $local = null)
    {
        if ($local === null) {
            $pathInfo   = pathinfo($remotePath);
            $fileName   = $pathInfo['filename'];
            $extension  = $pathInfo['extension'];

            $local = $fileName . '.' . $extension;
        }

        $remote = $this->cleanUrl($remotePath);
        return copy($remote, $local);
    }
    // }}}
    // {{{ put
    /**
     * Writes content of a local file to targetfile
     *
     * @public
     *
     * @param    $filepath (string) name of targetfile
     * @param    $sourcefile (string) path to sourcefile
     *
     * @return    $success (bool) true on success, false on error
     */
    public function put($local, $remotePath)
    {
        $remote = $this->cleanUrl($remotePath);
        return copy($local, $remote);
    }
    // }}}
    // {{{ exists
    /**
     * Checks if file exists
     *
     * @public
     *
     * @param $path (string) path to file to check
     *
     * @return $exist (bool) true if file exists, false otherwise
     */
    public function exists($remotePath)
    {
        $remote = $this->cleanUrl($remotePath);
        return file_exists($remote);
    }
    // }}}
    // {{{ fileInfo
    public function fileInfo($remotePath)
    {
        $remote = $this->cleanUrl($remotePath);
        return new \SplFileInfo($remote);
    }
    // }}}
    // {{{ getString
    public function getString($remotePath)
    {
        $remote = $this->cleanUrl($remotePath);
        return file_get_contents($remote);
    }
    // }}}
    // {{{ putString
    /**
     * Writes a String directly to a file
     *
     * @public
     *
     * @param    $filepath (string) name of targetfile
     * @param    $str (string) content to write to file
     *
     * @return    $success (bool) true on success, false on error
     */
    public function putString($remotePath, $string)
    {
        $remote = $this->cleanUrl($remotePath);
        return file_put_contents($remote, $string);
    }
    // }}}

    // {{{ parseUrl
    protected function parseUrl($url)
    {
        $parsed = parse_url($url);

        // hack, parse_url matches anything after the first question mark as "query"
        if (preg_match('/\?$/', $url) && isset($parsed['path']) && !isset($parsed['query'])) {
            $parsed['path'] .= '?';
            unset($parsed['query']);
        } elseif (isset($parsed['query'])) {
            if (isset($parsed['path'])) {
                $parsed['path'] .= '?' . $parsed['query'];
            } else {
                $parsed['path'] = '?' . $parsed['query'];
            }
            unset($parsed['query']);
        }

        return $parsed;
    }
    // }}}
    // {{{ cleanUrl
    protected function cleanUrl($url)
    {
        $parsed = $this->parseUrl($url);

        if (isset($parsed['scheme'])) {
            $newUrl = $parsed;
        } else {
            $newUrl = $this->url;
            if (isset($url[0]) && $url[0] == '/') {
                $newUrl['path'] = $url;
            } else {
                $newUrl['path'] = $this->base;
                $newUrl['path'] .= (isset($parsed['path'][0]) && $parsed['path'][0] == '/') ? $this->currentPath . '/' : '';
                $newUrl['path'] .= $parsed['path'];
            }
        }
        $newUrl['path'] = $this->cleanPath($newUrl['path']);
        if (!preg_match(';^' . preg_quote($this->cleanPath($this->base)) . '(.*)$;',  $newUrl['path'])) {
            throw new Exceptions\FSException('Cannot leave base directory ' . $this->base);
        }

        return $this->buildUrl($newUrl);
    }
    // }}}
    // {{{ cleanPath
    protected function cleanPath($path)
    {
        // @todo handle backslashes
        $dirs       = explode('/', $path);
        $newDirs    = array();

        foreach ($dirs as $dir) {
            if ($dir == '..') {
                array_pop($newDirs);
            } else if ($dir != '.' && $dir != '') {
                $newDirs[] = $dir;
            }
        }

        $newPath = (isset($path[0]) && $path[0] == '/') ? '/' : '';
        $newPath .= implode('/', $newDirs);

        return $newPath;
    }
    // }}}
    // {{{ buildUrl
    protected function buildUrl($parsed)
    {
        $path = $parsed['scheme'] . '://';
        $path .= isset($parsed['user']) ? $parsed['user']       : '';
        $path .= isset($parsed['pass']) ? ':' . $parsed['pass'] : '';
        $path .= isset($parsed['user']) ? '@'                   : '';
        $path .= isset($parsed['host']) ? $parsed['host']       : '';
        $path .= isset($parsed['port']) ? ':' . $parsed['port'] : '';
        $path .= isset($parsed['path']) ? $parsed['path']       : '/';

        return $path;
    }
    // }}}
    // {{{ lsFilter
    protected function lsFilter($path = '', $function)
    {
        // @todo slow
        $ls         = $this->ls($path);
        $lsFiles    = array_filter(
            $ls,
            function ($element) use ($function) {
                return $function($element);
            }
        );
        natcasesort($lsFiles);
        $sorted = array_values($lsFiles);

        return $sorted;
    }
    // }}}
    // {{{ lsRecursive
    protected function lsRecursive($path, $current)
    {
        $result = array();
        $patterns = explode('/', $path);
        $count = count($patterns);

        if ($count) {
            $pattern = array_shift($patterns);
            if (preg_match('/[\*\?\[\]]/', $pattern)) {
                $matches = array_filter(
                    $this->scanDir($current),
                    function ($node) use ($pattern) { return fnmatch($pattern, $node); }
                );
            } else {
                $matches = array($pattern);
            }

            foreach ($matches as $match) {
                $next = ($current) ? $current . '/' . $match : $match;

                if ($count == 1) {
                    $result[] = $next;
                } elseif (is_dir($this->cleanUrl($next))) {
                    $result = array_merge(
                        $result,
                        $this->lsRecursive(implode('/', $patterns), $next)
                    );
                }
            }
        }

        return $result;
    }
    // }}}
    // {{{ scanDir
    protected function scanDir($url = '', $hidden = null)
    {
        $cleanUrl = $this->cleanUrl($url);

        if ($hidden === null) {
            $hidden = $this->hidden;
        }

        $this->errorHandler(true);
        $scanDir = scandir($cleanUrl);
        $this->errorHandler(false);

        $filtered = array_diff($scanDir, array('.', '..'));

        if (!$hidden) {
            $filtered = array_filter(
                $filtered,
                function ($node) { return ($node[0] != '.'); }
            );
        }

        natcasesort($filtered);
        $sorted = array_values($filtered);

        return $sorted;
    }
    // }}}
    // {{{ errorHandler
    protected function errorHandler($start)
    {
        if ($start) {
            set_error_handler(
                function($errno, $errstr, $errfile, $errline, array $errcontext) {
                    throw new Exceptions\FSException($errstr);
                }
            );
        } else {
            restore_error_handler();
        }
    }
    // }}}
}

/* vim:set ft=php sw=4 sts=4 fdm=marker : */
