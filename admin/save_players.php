<?php
$json = file_get_contents("php://input");
$js = "const players = " . $json . ";";
file_put_contents("../js/players.js", $js);
echo "✅ Players file updated successfully!";
?>