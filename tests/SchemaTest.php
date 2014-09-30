<?php

use depage\DB\Schema;
use depage\DB\Exceptions;

// {{{ SchemaTestClass
class SchemaTestClass extends Schema
{
    public $executedStatements = array();
    public $currentTableVersion;

    public function getSql()
    {
        return $this->sql;
    }

    protected function execute($number, $statements)
    {
        $this->executedStatements[$number] = $statements;
    }

    protected function currentTableVersion($tableName)
    {
        return $this->currentTableVersion;
    }
}
// }}}

class SchemaTest extends PHPUnit_Framework_TestCase
{
    // {{{ setUp
    public function setUp()
    {
        $this->schema = new SchemaTestClass('');
    }
    // }}}

    // {{{ testLoad
    public function testLoad()
    {
        $this->schema->load('fixtures/TestFile.sql');

        $expected = array(
            'fixtures/TestFile.sql' => array(
                'version 0.1' => array(
                    3   => "# @version version 0.1\n",
                    4   => "    CREATE TABLE test (\n",
                    5   => "        uid int(10) unsigned NOT NULL DEFAULT '0',\n",
                    6   => "    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1';\n",
                    7   => "\n",
                ),
                'version 0.2' => array(
                    8   => "# @version version 0.2\n",
                    9   => "    ALTER TABLE test\n",
                    10  => "    ADD COLUMN did int(10) unsigned NOT NULL DEFAULT '0' AFTER pid;\n",
                    11  => "\n",
                    12  => "    ALTER TABLE test\n",
                    13  => "    COMMENT 'version 0.2';\n",
                ),
            ),
        );
        $this->assertEquals($expected, $this->schema->getSql());
    }
    // }}}
    // {{{ testLoadMultipleFiles
    public function testLoadMultipleFiles()
    {
        $this->schema->load('fixtures/TestFile*.sql');

        $expected = array(
            'fixtures/TestFile.sql' => array(
                'version 0.1' => array(
                    3   => "# @version version 0.1\n",
                    4   => "    CREATE TABLE test (\n",
                    5   => "        uid int(10) unsigned NOT NULL DEFAULT '0',\n",
                    6   => "    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1';\n",
                    7   => "\n",
                ),
                'version 0.2' => array(
                    8   => "# @version version 0.2\n",
                    9   => "    ALTER TABLE test\n",
                    10  => "    ADD COLUMN did int(10) unsigned NOT NULL DEFAULT '0' AFTER pid;\n",
                    11  => "\n",
                    12  => "    ALTER TABLE test\n",
                    13  => "    COMMENT 'version 0.2';\n",
                ),
            ),
            'fixtures/TestFile2.sql' => array(
                'version 0.1' => array(
                    3   => "# @version version 0.1\n",
                    4   => "    CREATE TABLE test2 (\n",
                    5   => "        uid int(10) unsigned NOT NULL DEFAULT '0',\n",
                    6   => "    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1';\n",
                    7   => "\n",
                ),
                'version 0.2' => array(
                    8   => "# @version version 0.2\n",
                    9   => "    ALTER TABLE test2\n",
                    10  => "    ADD COLUMN did int(10) unsigned NOT NULL DEFAULT '0' AFTER pid;\n",
                    11  => "\n",
                    12  => "    ALTER TABLE test2\n",
                    13  => "    COMMENT 'version 0.2';\n",
                ),
            ),
        );
        $this->assertEquals($expected, $this->schema->getSql());
    }
    // }}}
    // {{{ testLoadNoFile
    public function testLoadNoFile()
    {
        try {
            $this->schema->load('fileDoesntExist.sql');
        } catch (Exceptions\FileNotFoundException $expeceted) {
            return;
        }
        $this->fail('Expected FileNotFoundException');
    }
    // }}}
    // {{{ testLoadNoTableName
    public function testLoadNoTableName()
    {
        try {
            $this->schema->load('fixtures/TestNoTableName.sql');
        } catch (Exceptions\TableNameMissingException $expeceted) {
            return;
        }
        $this->fail('Expected TableNameMissingException');
    }
    // }}}
    // {{{ testLoadMultipleTableNames
    public function testLoadMultipleTableNames()
    {
        try {
            $this->schema->load('fixtures/TestMultipleTableNames.sql');
        } catch (Exceptions\MultipleTableNamesException $expeceted) {
            return;
        }
        $this->fail('Expected MultipleTableNamesException');
    }
    // }}}

    // {{{ testProcessNewestVersion
    public function testProcessNewestVersion()
    {
        $this->schema->currentTableVersion = 'version 0.2';
        $this->schema->load('fixtures/TestFile.sql');
        $this->schema->update();

        $expected = array();
        $this->assertEquals($expected, $this->schema->executedStatements);
    }
    // }}}
    // {{{ testProcessUpdate
    public function testProcessUpdate()
    {
        $this->schema->currentTableVersion = 'version 0.1';
        $this->schema->load('fixtures/TestFile.sql');
        $this->schema->update();

        $expected = array(
            10 => array("ALTER TABLE test ADD COLUMN did int(10) unsigned NOT NULL DEFAULT '0' AFTER pid"),
            13 => array("ALTER TABLE test COMMENT 'version 0.2'",),
        );
        $this->assertEquals($expected, $this->schema->executedStatements);
    }
    // }}}
    // {{{ testProcessEntireFile
    public function testProcessEntireFile()
    {
        $this->schema->currentTableVersion = '';
        $this->schema->load('fixtures/TestFile.sql');
        $this->schema->update();

        $expected = array(
            6   => array("CREATE TABLE test ( uid int(10) unsigned NOT NULL DEFAULT '0', ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1'"),
            10  => array("ALTER TABLE test ADD COLUMN did int(10) unsigned NOT NULL DEFAULT '0' AFTER pid",),
            13  => array("ALTER TABLE test COMMENT 'version 0.2'",),
        );

        $this->assertEquals($expected, $this->schema->executedStatements);
    }
    // }}}
    // {{{ testProcessConnections
    public function testProcessConnections()
    {
        $this->schema->currentTableVersion = '';
        $this->schema->load('fixtures/TestConnections.sql');
        $this->schema->update();

        $expected = array(
            8   => array("CREATE TABLE testTable ( uid int(10) unsigned NOT NULL DEFAULT '0', ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1'"),
            14  => array("CREATE VIEW testView AS SELECT id, name FROM testConnection WHERE someCondition=TRUE"),
        );

        $this->assertEquals($expected, $this->schema->executedStatements);
    }
    // }}}
    // {{{ testProcessPrefixes
    public function testProcessPrefixes()
    {
        $this->schema->currentTableVersion = '';
        $this->schema->load('fixtures/TestConnections.sql');
        $this->schema->setReplace(
            function ($tableName) {
                return 'testPrefix_' . $tableName;
            }
        );

        $this->schema->update();

        $expected = array(
            8   => array("CREATE TABLE testPrefix_testTable ( uid int(10) unsigned NOT NULL DEFAULT '0', ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='version 0.1'"),
            14  => array("CREATE VIEW testPrefix_testView AS SELECT id, name FROM testPrefix_testConnection WHERE someCondition=TRUE"),
        );

        $this->assertEquals($expected, $this->schema->executedStatements);
    }
    // }}}
}
