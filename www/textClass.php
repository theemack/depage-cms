<?php 

require_once('text.php');
require_once('email.php');
require_once('hidden.php');
require_once('url.php');
require_once('tel.php');
require_once('inputClass.php');
require_once('textarea.php');
require_once('password.php');
require_once('range.php');
require_once('number.php');

abstract class textClass extends inputClass {
    public function __toString() {
        $classes = $this->getClasses();
        $requiredChar = $this->getRequiredChar();
        return "<p id=\"$this->formName-$this->name\" class=\"$classes\"><label><span class=\"label\">$this->label<em>$requiredChar</em></span><input name=\"$this->name\" type=\"$this->type\" value=\"$this->value\"></label></p>";
    }

    protected function setDefaults() {
        parent::setDefaults();
        $this->defaults['value'] = '';
    }
}
