<?php
// ScrubMark Configuration for InfinityFree Hosting
// Update these values with the MySQL details from your InfinityFree vPanel

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Enable error reporting during initial setup (turn off in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// --- INFINITYFREE MYSQL CREDENTIALS ---
// Look in your InfinityFree vPanel -> "MySQL Databases" to find your exact host and username:
define('DB_HOST', 'sql100.infinityfree.com'); // e.g. sql100.infinityfree.com or sql200.epizy.com
define('DB_NAME', 'epiz_12345678_scrubmark'); // e.g. epiz_12345678_scrubmark
define('DB_USER', 'epiz_12345678');           // e.g. epiz_12345678
define('DB_PASS', 'YOUR_INFINITYFREE_PASSWORD'); // Your InfinityFree vPanel account password

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'error' => 'Database connection failed. Please check your DB credentials in config.php.',
                'details' => $e->getMessage()
            ]);
            exit;
        }
    }
    return $pdo;
}

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function getCurrentUser() {
    if (isset($_SESSION['user']) && !empty($_SESSION['user']['id'])) {
        return $_SESSION['user'];
    }
    return null;
}
