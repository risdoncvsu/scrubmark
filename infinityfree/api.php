<?php
// ScrubMark Backend API for InfinityFree
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Parse incoming JSON body
$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true) ?: [];

$db = getDbConnection();

switch ($action) {
    // -------------------------------------------------------------
    // AUTHENTICATION: REGISTER
    // -------------------------------------------------------------
    case 'register':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (empty($name) || empty($email) || empty($password)) {
            jsonResponse(['error' => 'All fields are required'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Invalid email address'], 400);
        }
        if (strlen($password) < 6) {
            jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
        }

        // Check duplicate email
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonResponse(['error' => 'An account with this email already exists'], 409);
        }

        $userId = bin2hex(random_bytes(16));
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $db->prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)');
        $stmt->execute([$userId, $name, $email, $hashedPassword]);

        $userData = ['id' => $userId, 'name' => $name, 'email' => $email];
        $_SESSION['user'] = $userData;

        jsonResponse($userData, 201);
        break;

    // -------------------------------------------------------------
    // AUTHENTICATION: LOGIN
    // -------------------------------------------------------------
    case 'login':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            jsonResponse(['error' => 'Email and password are required'], 400);
        }

        $stmt = $db->prepare('SELECT id, name, email, password FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(['error' => 'Invalid email or password'], 401);
        }

        $userData = ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']];
        $_SESSION['user'] = $userData;

        jsonResponse($userData);
        break;

    // -------------------------------------------------------------
    // AUTHENTICATION: LOGOUT
    // -------------------------------------------------------------
    case 'logout':
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        jsonResponse(['success' => true]);
        break;

    // -------------------------------------------------------------
    // AUTHENTICATION: CURRENT USER SESSION
    // -------------------------------------------------------------
    case 'me':
        $user = getCurrentUser();
        if (!$user) {
            jsonResponse(['error' => 'Not authenticated'], 401);
        }
        jsonResponse($user);
        break;

    // -------------------------------------------------------------
    // VIDEOS: LIST ALL VIDEOS
    // -------------------------------------------------------------
    case 'videos':
        $stmt = $db->query('SELECT id, youtube_video_id, project_name, user_id, owner_name, created_at FROM videos ORDER BY created_at DESC');
        $videos = $stmt->fetchAll();
        jsonResponse($videos);
        break;

    // -------------------------------------------------------------
    // VIDEOS: GET SINGLE VIDEO
    // -------------------------------------------------------------
    case 'video':
        $id = $_GET['id'] ?? '';
        $stmt = $db->prepare('SELECT id, youtube_video_id, project_name, user_id, owner_name, created_at FROM videos WHERE id = ?');
        $stmt->execute([$id]);
        $video = $stmt->fetch();
        if (!$video) {
            jsonResponse(['error' => 'Video not found'], 404);
        }
        jsonResponse($video);
        break;

    // -------------------------------------------------------------
    // VIDEOS: ADD VIDEO
    // -------------------------------------------------------------
    case 'add_video':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();
        if (!$user) jsonResponse(['error' => 'Unauthorized. Please log in.'], 401);

        $projectName = trim($body['project_name'] ?? '');
        $youtubeUrl = trim($body['youtube_url'] ?? '');

        if (empty($projectName) || empty($youtubeUrl)) {
            jsonResponse(['error' => 'Project name and YouTube URL are required'], 400);
        }

        // Extract YouTube ID via regex
        preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i', $youtubeUrl, $match);
        $youtubeId = $match[1] ?? null;

        if (!$youtubeId) {
            jsonResponse(['error' => 'Invalid YouTube URL'], 400);
        }

        $videoId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO videos (id, youtube_video_id, project_name, user_id, owner_name) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$videoId, $youtubeId, $projectName, $user['id'], $user['name']]);

        jsonResponse(['id' => $videoId]);
        break;

    // -------------------------------------------------------------
    // COMMENTS: LIST COMMENTS FOR VIDEO
    // -------------------------------------------------------------
    case 'comments':
        $videoId = $_GET['video_id'] ?? '';
        $stmt = $db->prepare('SELECT id, video_id, user_id, author_name, content, timestamp_seconds, is_resolved, created_at FROM comments WHERE video_id = ? ORDER BY timestamp_seconds ASC, created_at ASC');
        $stmt->execute([$videoId]);
        $comments = $stmt->fetchAll();
        foreach ($comments as &$c) {
            $c['timestamp_seconds'] = (float)$c['timestamp_seconds'];
            $c['is_resolved'] = (bool)$c['is_resolved'];
        }
        jsonResponse($comments);
        break;

    // -------------------------------------------------------------
    // COMMENTS: POST A NEW TIMESTAMPED COMMENT
    // -------------------------------------------------------------
    case 'add_comment':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();
        if (!$user) jsonResponse(['error' => 'Unauthorized. Please log in.'], 401);

        $videoId = $body['video_id'] ?? '';
        $content = trim($body['content'] ?? '');
        $timestamp = isset($body['timestamp_seconds']) ? (float)$body['timestamp_seconds'] : 0.0;

        if (empty($videoId) || empty($content)) {
            jsonResponse(['error' => 'Video ID and content are required'], 400);
        }

        $commentId = bin2hex(random_bytes(16));
        $stmt = $db->prepare('INSERT INTO comments (id, video_id, user_id, author_name, content, timestamp_seconds, is_resolved) VALUES (?, ?, ?, ?, ?, ?, 0)');
        $stmt->execute([$commentId, $videoId, $user['id'], $user['name'], $content, $timestamp]);

        jsonResponse([
            'id' => $commentId,
            'video_id' => $videoId,
            'user_id' => $user['id'],
            'author_name' => $user['name'],
            'content' => $content,
            'timestamp_seconds' => $timestamp,
            'is_resolved' => false,
            'created_at' => date('Y-m-d H:i:s')
        ], 201);
        break;

    // -------------------------------------------------------------
    // COMMENTS: RESOLVE COMMENT (OWNER AUTHORIZATION REQUIRED)
    // -------------------------------------------------------------
    case 'resolve_comment':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();
        if (!$user) jsonResponse(['error' => 'Unauthorized. Please log in.'], 401);

        $commentId = $body['comment_id'] ?? '';
        if (empty($commentId)) jsonResponse(['error' => 'Comment ID required'], 400);

        // Fetch comment and associated video owner
        $stmt = $db->prepare('SELECT c.id, c.video_id, v.user_id AS video_owner_id FROM comments c JOIN videos v ON c.video_id = v.id WHERE c.id = ?');
        $stmt->execute([$commentId]);
        $row = $stmt->fetch();

        if (!$row) {
            jsonResponse(['error' => 'Comment not found'], 404);
        }

        // Authorization check: Only video owner can mark comments as resolved
        if ($row['video_owner_id'] !== $user['id']) {
            jsonResponse(['error' => 'Forbidden: Only the video owner can resolve notes.'], 403);
        }

        $update = $db->prepare('UPDATE comments SET is_resolved = 1 WHERE id = ?');
        $update->execute([$commentId]);

        jsonResponse(['success' => true]);
        break;

    default:
        jsonResponse(['error' => 'Unknown endpoint action'], 404);
        break;
}
