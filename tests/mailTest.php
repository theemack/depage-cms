<?php

require_once('../mail.php');

use depage\mail\mail;

// {{{ mailTestClass
/**
 * Input is abstract, so we need this test class to instantiate it.
 **/
class mailTestClass extends mail {
    public function __construct($sender) {
        parent::__construct($sender);

        $this->mailFunction = array($this, "mailStub");
    }

    public function mailStub() {
        return func_get_args();
    }

    public function wordwrapTest($string, $width = 75, $forceCut = false) {
        return $this->wordwrap($string, $width, $forceCut);
    }

    public function stripTagsTest($string) {
        return $this->stripTags($string);
    }
}
// }}}

/**
 * General tests for the input class.
 **/
class mailTest extends PHPUnit_Framework_TestCase {
    // {{{ setUp()
    public function setUp() {
        $this->mail     = new mailTestClass("sender@domain.com");
    }
    // }}}
    
    // {{{ parseMailParts()
    public function parseMailParts($eml) {
        $mailparse = mailparse_msg_create();
        mailparse_msg_parse($mailparse, $eml);

        $structure = mailparse_msg_get_structure($mailparse);
        $parts = array();

        foreach ($structure as $partId) {
            $part = mailparse_msg_get_part($mailparse, $partId);
            $parts[$partId] = mailparse_msg_get_part_data($part);
        }

        return $parts;
    }
    // }}}
    // {{{ getBodyForPart()
    public function getBodyForPart($eml, $part) {
        $parts = $this->parseMailParts($eml);

        $start = $parts[$part]['starting-pos-body'];
        $end = $parts[$part]['ending-pos-body'];
        $body = substr($eml, $start, $end - $start);
        $encodingType = $parts[$part]['transfer-encoding'];

        if (strtolower($encodingType) == 'base64') {
            return base64_decode($body);
        } else if (strtolower($encodingType) == 'quoted-printable') {
            return quoted_printable_decode($body);
        } else {
            return $body;
        }
    }
    // }}}

    // {{{ testSubject()
    public function testSubject() {
        $this->mail->setSubject("my new subject: äöüß");

        $this->assertEquals("=?UTF-8?B?bXkgbmV3IHN1YmplY3Q6IMOkw7bDvMOf?=", $this->mail->getSubject());
    }
    // }}}
    // {{{ testRecients()
    public function testRecients() {
        $this->mail->setRecipients("recipient1@domain.com");

        $this->assertEquals("recipient1@domain.com", $this->mail->getRecipients());
    }
    // }}}
    // {{{ testRecientsArray()
    public function testRecientsArray() {
        $this->mail->setRecipients(array(
            "recipient1@domain.com",
            "recipient2@domain.com",
        ));

        $this->assertEquals("recipient1@domain.com,recipient2@domain.com", $this->mail->getRecipients());
    }
    // }}}
    // {{{ testCC()
    public function testCC() {
        $this->mail->setCC("cc@domain.com");

        $parts = $this->parseMailParts($this->mail->getEml());

        $this->assertRegExp("/^CC: cc@domain.com$/m", $this->mail->getHeaders());
        $this->assertEquals("cc@domain.com", $parts[1]['headers']['cc']);
    }
    // }}}
    // {{{ testBCC()
    public function testBCC() {
        $this->mail->setBCC("bcc@domain.com");

        $parts = $this->parseMailParts($this->mail->getEml());

        $this->assertRegExp("/^BCC: bcc@domain.com$/m", $this->mail->getHeaders());
        $this->assertEquals("bcc@domain.com", $parts[1]['headers']['bcc']);
    }
    // }}}
    // {{{ testReplyTo()
    public function testReplyTo() {
        $this->mail->setReplyTo("reply@domain.com");

        $parts = $this->parseMailParts($this->mail->getEml());

        $this->assertRegExp("/^Reply-To: reply@domain.com$/m", $this->mail->getHeaders());
        $this->assertEquals("reply@domain.com", $parts[1]['headers']['reply-to']);
    }
    // }}}
    // {{{ testPlainText()
    public function testPlainText() {
        $this->mail->setText("This is the text with a text line longer than the maximum text width of 75 characters\nSpecial Chars: äöüß");

        $body = $this->getBodyForPart($this->mail->getEml(), '1');

        $this->assertEquals("This is the text with a text line longer than the maximum text width of 75\ncharacters\nSpecial Chars: äöüß\n", $body);
    }
    // }}}
    // {{{ testHtmlText
    public function testHtmlText() {
        $this->mail->setHtmlText("<p>This is the text with a text line longer than the maximum text width of 75 characters</p>\n<p>Special Chars: äöüß</p>");

        $eml = $this->mail->getEml();
        $parts = $this->parseMailParts($eml);

        $plainText = $this->getBodyForPart($eml, '1.1');
        $htmlText = $this->getBodyForPart($eml, '1.2');

        $this->assertEquals("text/plain; charset=\"UTF-8\"", $parts['1.1']['headers']['content-type']);
        $this->assertEquals("This is the text with a text line longer than the maximum text width of 75\ncharacters\nSpecial Chars: äöüß\n", $plainText);

        $this->assertEquals("text/html; charset=\"UTF-8\"", $parts['1.2']['headers']['content-type']);
        $this->assertEquals("<p>This is the text with a text line longer than the maximum text width of\n75 characters</p>\n<p>Special Chars: äöüß</p>", $htmlText);
    }
    // }}}
    // {{{ testAttachString
    public function testAttachString() {
        $this->mail->attachStr("Special Chars: äöüß", "text/plain");

        $eml = $this->mail->getEml();
        $parts = $this->parseMailParts($eml);

        $attachment = $this->getBodyForPart($eml, '1.2');

        $this->assertEquals("text/plain", $parts['1.2']['headers']['content-type']);
        $this->assertEquals("Special Chars: äöüß", $attachment);
    }
    // }}}
    // {{{ testAttachFile
    public function testAttachFile() {
        $filename = __FILE__;

        $this->mail->attachFile($filename);

        $eml = $this->mail->getEml();
        $parts = $this->parseMailParts($eml);

        $attachment = $this->getBodyForPart($eml, '1.2');

        $this->assertEquals("application/octet_stream", $parts['1.2']['headers']['content-type']);
        $this->assertEquals("attachement; filename=\"" . basename($filename) . "\"", $parts['1.2']['headers']['content-disposition']);
        $this->assertStringEqualsFile($filename, $attachment);
    }
    // }}}
    // {{{ testWorwrap
    public function testWordwrap() {
        $wrapped1 = $this->mail->wordwrapTest("This is a text", 5);
        $wrapped2 = $this->mail->wordwrapTest("ThisIsALongWord", 8);
        $wrapped3 = $this->mail->wordwrapTest("ThisIsALongWord", 8, true);

        $this->assertEquals("This\nis a\ntext", $wrapped1);
        $this->assertEquals("ThisIsALongWord", $wrapped2);
        $this->assertEquals("ThisIsAL\nongWord", $wrapped3);
    }
    // }}}
    // {{{ testStripTags
    public function testStripTags() {
        $stripped1 = $this->mail->stripTagsTest("Te<p>Text</p>st");
        $stripped2 = $this->mail->stripTagsTest("Te<style>Text</style>st");
        $stripped3 = $this->mail->stripTagsTest("Te<object>Text</object>st");
        $stripped4 = $this->mail->stripTagsTest("Te<embed>Text</embed>st");
        $stripped5 = $this->mail->stripTagsTest("Te<applet>Text</applet>st");
        $stripped6 = $this->mail->stripTagsTest("Te<noframes>Text</noframes>st");
        $stripped7 = $this->mail->stripTagsTest("Te<noembed>Text</noembed>st");
        $stripped8 = $this->mail->stripTagsTest("Te<script>Text</script>st");

        $this->assertEquals("TeTextst", $stripped1);
        $this->assertEquals("Test", $stripped2);
        $this->assertEquals("Test", $stripped3);
        $this->assertEquals("Test", $stripped4);
        $this->assertEquals("Test", $stripped5);
        $this->assertEquals("Test", $stripped6);
        $this->assertEquals("Test", $stripped7);
        $this->assertEquals("Test", $stripped8);
        $this->assertEquals("Test", $stripped8);
    }
    // }}}
    // {{{ testSend
    public function testSend() {
        $this->mail
            ->setSubject("Subject")
            ->setText("Text");

        $results = $this->mail->send("recipient@domain.com");

        $this->assertEquals("recipient@domain.com", $results[0]);
        $this->assertEquals("=?UTF-8?B?U3ViamVjdA==?=", $results[1]);
        $this->assertEquals("Text", $results[2]);
        $this->assertEquals("From: sender@domain.com\nX-Mailer: depage-mail (" . $this->mail->getVersion() . ")\nContent-type: text/plain; charset=UTF-8\nContent-transfer-encoding: quoted-printable", $results[3]);
    }
    // }}}
}

/* vim:set ft=php sw=4 sts=4 fdm=marker et : */
