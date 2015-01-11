<?php

namespace Depage\Cms\Auth;

/**
 * brief CmsUser
 * Class CmsUser
 */
class CmsUser extends \Depage\Auth\User
{
    protected $level = 4;

    // {{{ getLevel()
    /**
     * @brief getLevel
     *
     * @param mixed
     * @return void
     **/
    protected function getLevel()
    {

    }
    // }}}
    // {{{ setLevel()
    /**
     * @brief setLevel
     *
     * @param mixed
     * @return void
     **/
    protected function setLevel($value)
    {
        // read only
    }
    // }}}

    // user rights:
    // {{{ canEditAllUsers()
    /**
     * @brief canEditAllUsers
     *
     * @return bool true of false if the user can edit all projects
     **/
    public function canEditAllUsers()
    {
        return $this->level == 1;
    }
    // }}}
    // {{{ canEditAllProjects()
    /**
     * @brief canEditAllProjects
     *
     * @return bool true of false if the user can edit all projects
     **/
    public function canEditAllProjects()
    {
        return $this->level == 1;
    }
    // }}}
    // {{{ canAddProjects()
    /**
     * @brief canAddProjects
     *
     * @return bool true of false if the user can edit all projects
     **/
    public function canAddProjects()
    {
        return $this->canEditAllProjects();
    }
    // }}}
}

// vim:set ft=php sw=4 sts=4 fdm=marker et :
