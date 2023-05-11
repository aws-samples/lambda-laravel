<?php

namespace App\Lib;

class Helper
{
    public static function ms($string = null): int
    {
        if ($string === null) {
            $string = (string)microtime(true);
        }

        $string = str_replace(".", "", $string);

        $string .= "0000";

        return mb_strcut($string, 0, 13);
    }
}
