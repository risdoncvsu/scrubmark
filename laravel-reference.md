# Laravel & PHP Reference Implementation

While the working prototype in this workspace is built using React, Node.js (Express), and SQLite to run natively in this sandboxed container, here are the exact Laravel components you requested for your PHP environment.

## 1. Database Migrations

\`\`\`php
// database/migrations/xxxx_xx_xx_xxxxxx_create_videos_table.php
use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('project_name');
            $table->string('youtube_video_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('videos');
    }
};
\`\`\`

\`\`\`php
// database/migrations/xxxx_xx_xx_xxxxxx_create_comments_table.php
use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('video_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->decimal('timestamp_seconds', 8, 2);
            $table->boolean('is_resolved')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
\`\`\`

## 2. Eloquent Models

\`\`\`php
// app/Models/Video.php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;

class Video extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'project_name', 'youtube_video_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}
\`\`\`

\`\`\`php
// app/Models/Comment.php
namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;

class Comment extends Model
{
    use HasFactory;

    protected $fillable = ['video_id', 'user_id', 'content', 'timestamp_seconds', 'is_resolved'];

    protected $casts = [
        'is_resolved' => 'boolean',
        'timestamp_seconds' => 'float',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function video()
    {
        return $this->belongsTo(Video::class);
    }
}
\`\`\`

## 3. Web Routes

\`\`\`php
// routes/web.php
use App\\Http\\Controllers\\VideoController;
use App\\Http\\Controllers\\CommentController;
use Illuminate\\Support\\Facades\\Route;

Route::middleware('auth')->group(function () {
    Route::get('/videos', [VideoController::class, 'index'])->name('videos.index');
    Route::post('/videos', [VideoController::class, 'store'])->name('videos.store');
    Route::get('/videos/{video}', [VideoController::class, 'show'])->name('videos.show');

    // API endpoints for AJAX commenting engine
    Route::post('/api/videos/{video}/comments', [CommentController::class, 'store']);
    Route::patch('/api/comments/{comment}/resolve', [CommentController::class, 'resolve']);
});
\`\`\`

## 4. Controllers

\`\`\`php
// app/Http/Controllers/VideoController.php
namespace App\\Http\\Controllers;

use App\\Models\\Video;
use Illuminate\\Http\\Request;

class VideoController extends Controller
{
    public function index()
    {
        $videos = auth()->user()->videos()->latest()->get();
        return view('videos.index', compact('videos'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'project_name' => 'required|string|max:255',
            'youtube_url' => 'required|url'
        ]);

        // Basic Regex to extract YouTube ID
        preg_match('/(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/i', $request->youtube_url, $match);
        $videoId = $match[1] ?? null;

        if (!$videoId) {
            return back()->withErrors(['youtube_url' => 'Invalid YouTube URL.']);
        }

        auth()->user()->videos()->create([
            'project_name' => $request->project_name,
            'youtube_video_id' => $videoId,
        ]);

        return redirect()->route('videos.index');
    }

    public function show(Video $video)
    {
        $comments = $video->comments()->with('user')->orderBy('timestamp_seconds')->get();
        return view('videos.show', compact('video', 'comments'));
    }
}
\`\`\`

\`\`\`php
// app/Http/Controllers/CommentController.php
namespace App\\Http\\Controllers;

use App\\Models\\Comment;
use App\\Models\\Video;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Gate;

class CommentController extends Controller
{
    public function store(Request $request, Video $video)
    {
        $request->validate([
            'content' => 'required|string|max:1000',
            'timestamp_seconds' => 'required|numeric',
        ]);

        $comment = $video->comments()->create([
            'user_id' => auth()->id(),
            'content' => $request->content,
            'timestamp_seconds' => $request->timestamp_seconds,
            'is_resolved' => false,
        ]);

        return response()->json($comment->load('user'));
    }

    public function resolve(Request $request, Comment $comment)
    {
        // Authorization: Only the video owner can resolve comments
        if (auth()->id() !== $comment->video->user_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $comment->update(['is_resolved' => true]);

        return response()->json(['success' => true]);
    }
}
\`\`\`

## 5. Vanilla JavaScript (Frontend Video Logic)

\`\`\`javascript
// Included in your Blade view (e.g., resources/views/videos/show.blade.php)

let player;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '390',
        width: '640',
        videoId: '{{ $video->youtube_video_id }}',
        playerVars: {
            'controls': 0, // Hide native controls
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    // Player is ready
}

// 1. Pause video on comment input focus
document.getElementById('comment-input').addEventListener('focus', function() {
    if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    }
    const currentTime = player.getCurrentTime();
    document.getElementById('timestamp-input').value = currentTime;
});

// 2. Submit comment via fetch
document.getElementById('comment-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const content = document.getElementById('comment-input').value;
    const timestamp = document.getElementById('timestamp-input').value;

    const res = await fetch(\`/api/videos/{{ $video->id }}/comments\`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ content, timestamp_seconds: timestamp })
    });

    const comment = await res.json();
    appendCommentToSidebar(comment);
    document.getElementById('comment-input').value = '';
});

// 3. Scrub to timestamp
function jumpToTime(seconds) {
    if (player) {
        player.seekTo(seconds, true);
        player.playVideo();
    }
}

// 4. Resolve comment
async function resolveComment(commentId, buttonElement) {
    const res = await fetch(\`/api/comments/\${commentId}/resolve\`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        }
    });

    if (res.ok) {
        const commentCard = buttonElement.closest('.comment-card');
        commentCard.classList.add('resolved-style', 'opacity-50', 'line-through');
        document.getElementById('resolved-container').appendChild(commentCard);
    }
}
\`\`\`
