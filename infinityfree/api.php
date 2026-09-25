<?php
// ScrubMark Backend API for InfinityFree
require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, x-user-id, x-user-name, X-User-Id, X-User-Name');
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

// Auto-upgrade database schema for Google Drive support if needed
try {
    $db->exec("ALTER TABLE videos MODIFY COLUMN youtube_video_id VARCHAR(255) NOT NULL");
} catch (Exception $e) {}
try {
    $db->exec("ALTER TABLE videos ADD COLUMN source_type VARCHAR(32) DEFAULT 'youtube'");
} catch (Exception $e) {}

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
    // VIDEOS: LIST VIDEOS FOR AUTHENTICATED USER
    // -------------------------------------------------------------
    case 'videos':
        $user = getCurrentUser();
        if (!$user) {
            jsonResponse(['error' => 'Unauthorized: Please log in'], 401);
        }
        $userId = $user['id'];
        try {
            $stmt = $db->prepare("SELECT id, youtube_video_id, COALESCE(source_type, 'youtube') as source_type, project_name, user_id, owner_name, created_at FROM videos WHERE user_id = ? ORDER BY created_at DESC");
            $stmt->execute([$userId]);
            $videos = $stmt->fetchAll();
        } catch (Exception $e) {
            $stmt = $db->prepare('SELECT id, youtube_video_id, project_name, user_id, owner_name, created_at FROM videos WHERE user_id = ? ORDER BY created_at DESC');
            $stmt->execute([$userId]);
            $videos = $stmt->fetchAll();
        }
        jsonResponse($videos);
        break;

    // -------------------------------------------------------------
    // VIDEOS: DELETE VIDEO (OWNER ONLY)
    // -------------------------------------------------------------
    case 'delete_video':
        if ($method !== 'POST' && $method !== 'DELETE') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();
        if (!$user) jsonResponse(['error' => 'Unauthorized'], 401);
        
        $videoId = $_GET['id'] ?? $body['id'] ?? '';
        if (!$videoId) jsonResponse(['error' => 'Video ID is required'], 400);

        // Verify ownership
        $stmt = $db->prepare('SELECT user_id FROM videos WHERE id = ?');
        $stmt->execute([$videoId]);
        $video = $stmt->fetch();
        if (!$video) jsonResponse(['error' => 'Video not found'], 404);
        if ($video['user_id'] !== $user['id']) {
            jsonResponse(['error' => 'Only the owner can delete this project'], 403);
        }

        // Delete comments and the video
        $stmt = $db->prepare('DELETE FROM comments WHERE video_id = ?');
        $stmt->execute([$videoId]);
        $stmt = $db->prepare('DELETE FROM videos WHERE id = ?');
        $stmt->execute([$videoId]);

        jsonResponse(['success' => true]);
        break;

    // -------------------------------------------------------------
    // VIDEOS: GET SINGLE VIDEO
    // -------------------------------------------------------------
    case 'video':
        $id = $_GET['id'] ?? '';
        try {
            $stmt = $db->prepare("SELECT id, youtube_video_id, COALESCE(source_type, 'youtube') as source_type, project_name, user_id, owner_name, created_at FROM videos WHERE id = ?");
            $stmt->execute([$id]);
            $video = $stmt->fetch();
        } catch (Exception $e) {
            $stmt = $db->prepare('SELECT id, youtube_video_id, project_name, user_id, owner_name, created_at FROM videos WHERE id = ?');
            $stmt->execute([$id]);
            $video = $stmt->fetch();
        }
        if (!$video) {
            jsonResponse(['error' => 'Video not found'], 404);
        }
        jsonResponse($video);
        break;

    // -------------------------------------------------------------
    // VIDEOS: ADD VIDEO (YOUTUBE OR GOOGLE DRIVE)
    // -------------------------------------------------------------
    case 'add_video':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();
        if (!$user) jsonResponse(['error' => 'Unauthorized. Please log in.'], 401);

        $projectName = trim($body['project_name'] ?? '');
        $videoUrl = trim($body['video_url'] ?? $body['youtube_url'] ?? '');

        if (empty($projectName) || empty($videoUrl)) {
            jsonResponse(['error' => 'Project name and Video URL are required'], 400);
        }

        $sourceType = 'youtube';
        $sourceId = null;

        // 1. YouTube Match
        if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i', $videoUrl, $match)) {
            $sourceType = 'youtube';
            $sourceId = $match[1];
        }
        // 2. Google Drive Match
        elseif (
            preg_match('/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]{20,})/i', $videoUrl, $match) ||
            preg_match('/[?&]id=([a-zA-Z0-9_-]{20,})/i', $videoUrl, $match) ||
            preg_match('/\/file\/d\/([a-zA-Z0-9_-]+)/i', $videoUrl, $match)
        ) {
            $sourceType = 'google_drive';
            $sourceId = $match[1];
        }
        // 3. Direct Video Link Match
        elseif (preg_match('/^https?:\/\/.*?\.(mp4|webm|mov|ogg)(\?.*)?$/i', $videoUrl)) {
            $sourceType = 'direct';
            $sourceId = $videoUrl;
        } else {
            jsonResponse(['error' => 'Please provide a valid YouTube URL or Google Drive link.'], 400);
        }

        $videoId = bin2hex(random_bytes(16));
        try {
            $stmt = $db->prepare('INSERT INTO videos (id, youtube_video_id, source_type, project_name, user_id, owner_name) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$videoId, $sourceId, $sourceType, $projectName, $user['id'], $user['name']]);
        } catch (Exception $e) {
            $stmt = $db->prepare('INSERT INTO videos (id, youtube_video_id, project_name, user_id, owner_name) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$videoId, $sourceId, $projectName, $user['id'], $user['name']]);
        }

        jsonResponse(['id' => $videoId]);
        break;

    // -------------------------------------------------------------
    // COMMENTS: LIST COMMENTS FOR VIDEO
    // -------------------------------------------------------------
    case 'comments':
        $videoId = $_GET['video_id'] ?? '';
        try {
            $stmt = $db->prepare('SELECT id, video_id, user_id, author_name, content, drawing_data, timestamp_seconds, is_resolved, created_at FROM comments WHERE video_id = ? ORDER BY timestamp_seconds ASC, created_at ASC');
            $stmt->execute([$videoId]);
            $comments = $stmt->fetchAll();
        } catch (PDOException $e) {
            $stmt = $db->prepare('SELECT id, video_id, user_id, author_name, content, timestamp_seconds, is_resolved, created_at FROM comments WHERE video_id = ? ORDER BY timestamp_seconds ASC, created_at ASC');
            $stmt->execute([$videoId]);
            $comments = $stmt->fetchAll();
        }
        foreach ($comments as &$c) {
            $c['timestamp_seconds'] = (float)$c['timestamp_seconds'];
            $c['is_resolved'] = (bool)$c['is_resolved'];
            if (!isset($c['drawing_data'])) {
                $c['drawing_data'] = null;
            }
        }
        jsonResponse($comments);
        break;

    // -------------------------------------------------------------
    // COMMENTS: POST A NEW TIMESTAMPED COMMENT
    // -------------------------------------------------------------
    case 'add_comment':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        $user = getCurrentUser();

        $videoId = $body['video_id'] ?? '';
        $content = trim($body['content'] ?? '');
        $drawingData = $body['drawing_data'] ?? null;
        $timestamp = isset($body['timestamp_seconds']) ? (float)$body['timestamp_seconds'] : 0.0;
        $authorName = trim($body['author_name'] ?? '');

        if (empty($content) && !empty($drawingData)) {
            $content = 'Visual frame annotation';
        }

        if (empty($videoId) || (empty($content) && empty($drawingData))) {
            jsonResponse(['error' => 'Video ID and comment content are required'], 400);
        }

        // Fetch video to verify it exists and get video owner's ID
        $vStmt = $db->prepare('SELECT id, user_id FROM videos WHERE id = ?');
        $vStmt->execute([$videoId]);
        $video = $vStmt->fetch();
        if (!$video) {
            jsonResponse(['error' => 'Video not found'], 404);
        }

        // Determine author display name
        if ($user && !empty($user['id']) && !str_starts_with($user['id'], 'client_')) {
            $author = !empty($authorName) ? $authorName : $user['name'];
            $uid = $user['id'];
        } else {
            $author = !empty($authorName) ? $authorName : (!empty($user['name']) ? $user['name'] : 'Client Reviewer');
            $uid = $user['id'] ?? ('client_' . bin2hex(random_bytes(6)));
        }

        // Check if $uid exists in users table (to safely satisfy fk_comments_user if present in MySQL)
        $uCheck = $db->prepare('SELECT id FROM users WHERE id = ?');
        $uCheck->execute([$uid]);
        if (!$uCheck->fetch()) {
            // Client is a guest reviewer not in users table: use video owner's ID for foreign key compliance
            $uid = $video['user_id'];
        }

        $commentId = bin2hex(random_bytes(16));
        try {
            $stmt = $db->prepare('INSERT INTO comments (id, video_id, user_id, author_name, content, drawing_data, timestamp_seconds, is_resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)');
            $stmt->execute([$commentId, $videoId, $uid, $author, $content, $drawingData, $timestamp]);
        } catch (PDOException $e) {
            // Fallback if drawing_data column doesn't exist yet on user's database
            $stmt = $db->prepare('INSERT INTO comments (id, video_id, user_id, author_name, content, timestamp_seconds, is_resolved) VALUES (?, ?, ?, ?, ?, ?, 0)');
            $stmt->execute([$commentId, $videoId, $uid, $author, $content, $timestamp]);
        }

        jsonResponse([
            'id' => $commentId,
            'video_id' => $videoId,
            'user_id' => $uid,
            'author_name' => $author,
            'content' => $content,
            'drawing_data' => $drawingData,
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

    // -------------------------------------------------------------
    // PROXY THUMBNAIL: FOR CANVAS FRAME ANNOTATIONS
    // -------------------------------------------------------------
    case 'proxy_thumbnail':
        $id = $_GET['id'] ?? '';
        $type = $_GET['type'] ?? 'youtube';
        if (empty($id)) {
            http_response_code(400);
            exit('Missing id parameter');
        }

        $targetUrl = ($type === 'google_drive')
            ? "https://drive.google.com/thumbnail?id={$id}&sz=w1280"
            : "https://img.youtube.com/vi/{$id}/hqdefault.jpg";

        $ctx = stream_context_create([
            'http' => [
                'timeout' => 5,
                'header' => "User-Agent: Mozilla/5.0\r\n"
            ]
        ]);

        $imageData = @file_get_contents($targetUrl, false, $ctx);
        if ($imageData === false && $type !== 'google_drive') {
            $fallbackUrl = "https://img.youtube.com/vi/{$id}/mqdefault.jpg";
            $imageData = @file_get_contents($fallbackUrl, false, $ctx);
        }

        if ($imageData !== false) {
            header('Content-Type: image/jpeg');
            header('Cache-Control: public, max-age=86400');
            header('Access-Control-Allow-Origin: *');
            echo $imageData;
            exit;
        } else {
            http_response_code(502);
            exit('Failed to fetch thumbnail');
        }
        break;

    default:
        jsonResponse(['error' => 'Unknown endpoint action'], 404);
        break;
}
