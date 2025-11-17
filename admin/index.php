<?php
session_start();

$ADMIN_PIN = "45822"; // <-- CHANGE THIS

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($_POST['pin'] === $ADMIN_PIN) {
        $_SESSION['gtl_admin'] = true;
        header("Location: dashboard.php");
        exit;
    } else {
        $error = "Incorrect PIN";
    }
}
?>
<!DOCTYPE html>
<html>
<head>
<title>GTL Admin Login</title>
<style>
body { font-family: Arial; padding: 30px; }
input { padding: 10px; font-size: 18px; }
button { padding: 10px 20px; font-size: 18px; }
.error { color: red; }
</style>
</head>
<body>

<h2>GTL Admin Login</h2>

<?php if (!empty($error)) echo "<div class='error'>$error</div>"; ?>

<form method="post">
    <input type="password" name="pin" placeholder="Enter PIN" required>
    <button type="submit">Login</button>
</form>

</body>
</html>
