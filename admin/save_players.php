<?php

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid JSON"]);
    exit;
}

foreach ($data["players"] as &$player) {
    foreach ($player["scores"] as $i => $scoreInput) {

        $val = trim($scoreInput);

        if (
            $val === "" ||
            strtolower($val) === "x" ||
            strtolower($val) === "ns" ||
            $val === "—" ||
            $val == 99 ||
            !is_numeric($val)
        ) {
            $player["scores"][$i] = null;
        } else {
            $player["scores"][$i] = intval($val);
        }
    }
}

// Write JSON safely
file_put_contents(
    "../data/players.json",
    json_encode($data, JSON_PRETTY_PRINT)
);

echo json_encode(["status" => "success"]);
