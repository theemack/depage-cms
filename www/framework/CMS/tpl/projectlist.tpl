<ul id="projectlist">
    <?php foreach($this->projects as $pname => $pid) { ?>
        <li>
            <h2><?php html::t($pname); ?></h2>
            <a href="project/<?php html::t($pname); ?>/edit/" class="button">
                <?php html::t(_('edit')) ?>
            </a>
            <a href="project/<?php html::t($pname); ?>/preview/" class="button">
                <?php html::t(_('preview')) ?>
            </a>
        </li>
    <?php } ?>
</ul>
<?php // vim:set ft=php sw=4 sts=4 fdm=marker et :
