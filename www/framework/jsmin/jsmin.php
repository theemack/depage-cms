<?php
/**
 * @file    jsmin.php
 * @brief   jsmin class
 *
 * @author  Frank Hellenkamp <jonas@depage.net>
 **/

namespace depage\jsmin;

/**
 * @brief Main jsmin class
 **/
abstract class jsmin {
    // {{{ variables
    // }}}
    // {{{ factory()
    /**
     * @brief   jsmin object factory
     * 
     * Generates minify object
     *
     * @param   $options (array) jsmin processing parameters
     * @return  (object) jsmin object
     **/
    public static function factory($options = array()) {
        $extension = (isset($options['extension'])) ? $options['extension'] : 'closure-api';

        if ( $extension == 'closure-api' ) {
        }
        return new jsmin_closure_api($options);
    }
    // }}}
    // {{{ __construct()
    /**
     * @brief graphics class constructor
     *
     * @param $options (array) image processing parameters
     **/
    public function __construct($options = array()) {
    }
    // }}}
    
    // {{{ minify()
    /**
     * @brief minifies js-source
     *
     * @param $src javascript source code
     **/
    abstract public function minify($src);
    // }}}
}

/* vim:set ft=php sw=4 sts=4 fdm=marker et : */
