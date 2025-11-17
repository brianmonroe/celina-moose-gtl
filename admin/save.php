<?php
session_start();
if (!isset($_SESSION['gtl_admin'])) {
    http_response_code(403);
    echo "Not authorized";
    exit;
}

$json = file_get_contents("php://input");

if (!$json) {
    echo "No data received";
    exit;
}

file_put_contents("../data/players.json", $json);

echo "Saved successfully!";
