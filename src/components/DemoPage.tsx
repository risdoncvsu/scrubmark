import React, { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { 
  ChevronRight, 
  ChevronLeft, 
  Copy, 
  Check, 
  MessageSquare, 
  Share2, 
  Video, 
  ArrowLeft, 
  Plus, 
  X, 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  Edit3,
  ExternalLink
} from 'lucide-react';
import { formatTime } from '../utils';

interface DemoPageProps {
  onExit: () => void;
  onAutoAddVideo?: (projectName: string, videoUrl: string) => Promise<string | void>;
  onSelectVideo?: (videoId: string) => void;
  initialStep?: number;
}

interface DemoComment {
  id: string;
  timestamp_seconds: number;
  author_name: string;
  content: string;
  is_resolved?: boolean;
}

const SAMPLE_LINK = 'https://www.youtube.com/watch?v=3iRUwVzRDZQ&t';
const SAMPLE_YT_ID = '3iRUwVzRDZQ';

export function DemoPage({
  onExit,
  onAutoAddVideo,
  onSelectVideo,
  initialStep = 1
}: DemoPageProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [copiedPageUrl, setCopiedPageUrl] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [isSubmittingRaffle, setIsSubmittingRaffle] = useState(false);
  const [raffleSubmitted, setRaffleSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [raffleError, setRaffleError] = useState<string | null>(null);

  // Form State: Name and Email only
  const [raffleName, setRaffleName] = useState('');
  const [raffleEmail, setRaffleEmail] = useState('');

  // Add Video Popup State
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('Cyberpunk City Edit (Sample Cut)');
  const [videoUrlInput, setVideoUrlInput] = useState(SAMPLE_LINK);
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  // Step 4: Real functional video review state (matches VideoReview.tsx)
  const [currentTimestamp, setCurrentTimestamp] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputStr, setTimeInputStr] = useState('0:15');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const playerRef = useRef<any>(null);

  // Comments matching main site data model
  const [comments, setComments] = useState<DemoComment[]>([
    { id: 'c1', timestamp_seconds: 15, author_name: 'Alex (Director)', content: 'Trim this opening shot by 12 frames to tighten pacing.', is_resolved: false },
    { id: 'c2', timestamp: 42, timestamp_seconds: 42, author_name: 'Maya (Colorist)', content: 'Skin tones are slightly magenta here; adjust saturation.', is_resolved: false },
    { id: 'c3', timestamp_seconds: 78, author_name: 'Sarah (Client)', content: 'The title card looks great, can we hold it for 1 more second?', is_resolved: false },
  ]);
  const [newCommentText, setNewCommentText] = useState('');

  // Tutorial comment approval popup modal state
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [lastSubmittedComment, setLastSubmittedComment] = useState<DemoComment | null>(null);

  // Read step from URL search param if present (?step=1..5)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stepParam = parseInt(params.get('step') || '', 10);
      if (stepParam >= 1 && stepParam <= 5) {
        setCurrentStep(stepParam);
      }
    }
  }, []);

  // Poll YouTube player timestamp when on Step 4
  useEffect(() => {
    if (currentStep !== 4) return;
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const t = playerRef.current.getCurrentTime() || 0;
        setCurrentTimestamp(t);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [currentStep]);

  // YouTube player handlers
  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    setIsPlaying(event.data === 1);
  };

  const togglePlayPause = () => {
    if (playerRef.current) {
      const state = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
      if (state === 1) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(prev => !prev);
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      const cur = playerRef.current.getCurrentTime() || 0;
      const nextTime = Math.max(0, cur + deltaSeconds);
      playerRef.current.seekTo(nextTime, true);
      setCurrentTimestamp(nextTime);
    } else {
      setCurrentTimestamp(prev => Math.max(0, prev + deltaSeconds));
    }
  };

  const jumpToTime = (seconds: number) => {
    setCurrentTimestamp(seconds);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const resolveComment = (id: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, is_resolved: !c.is_resolved } : c));
  };

  const handleTimeInputSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsEditingTime(false);
    const parts = timeInputStr.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 2) {
      seconds = (parts[0] || 0) * 60 + (parts[1] || 0);
    } else if (parts.length === 1) {
      seconds = parts[0] || 0;
    }
    jumpToTime(seconds);
  };

  // Keyboard navigation hotkeys for Step 4
  useEffect(() => {
    if (currentStep !== 4) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isPlaying]);

  const getFullDemoUrl = () => {
    if (typeof window === 'undefined') return 'https://scrubmark.com/demo';
    return `${window.location.origin}/demo`;
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  const handleCopyPageUrl = () => {
    const url = getFullDemoUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPageUrl(true);
      setTimeout(() => setCopiedPageUrl(false), 2500);
    }).catch(() => {
      fallbackCopy(url);
      setCopiedPageUrl(true);
      setTimeout(() => setCopiedPageUrl(false), 2500);
    });
  };

  // Automatically triggers the Add Video popup modal when user copies the link
  const triggerAddVideoModalWithSample = () => {
    setVideoUrlInput(SAMPLE_LINK);
    setIsAddVideoModalOpen(true);
  };

  const handleCopySampleLink = () => {
    navigator.clipboard.writeText(SAMPLE_LINK).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }).catch(() => {
      fallbackCopy(SAMPLE_LINK);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });

    // Auto-fill and immediately open the "Add Video" popup before proceeding to video
    triggerAddVideoModalWithSample();
  };

  const handleCopyShareLink = () => {
    const demoUrl = `${window.location.origin}/?v=sample-cut-demo`;
    navigator.clipboard.writeText(demoUrl).then(() => {
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 2500);
    }).catch(() => {
      fallbackCopy(demoUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 2500);
    });
  };

  const handleCopyTicket = () => {
    if (!ticketNumber) return;
    navigator.clipboard.writeText(ticketNumber).then(() => {
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    }).catch(() => {
      fallbackCopy(ticketNumber);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    });
  };

  // Called when user submits the "Add Video" popup
  const handleConfirmAddVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAddingVideo(true);

    if (onAutoAddVideo) {
      try {
        await onAutoAddVideo(projectNameInput || 'Cyberpunk City Edit (Sample Cut)', videoUrlInput || SAMPLE_LINK);
      } catch (err) {
        console.error('Add video error:', err);
      }
    }

    // Brief smooth ingestion transition, then advance to Step 4 (Video review demo)
    setTimeout(() => {
      setIsAddingVideo(false);
      setIsAddVideoModalOpen(false);
      setCurrentStep(4);
    }, 600);
  };

  // Step 4: Handles user submitting a comment in the main review workspace
  const handlePostReviewComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: DemoComment = {
      id: 'c_' + Date.now(),
      timestamp_seconds: Math.floor(currentTimestamp),
      author_name: 'You (Tester)',
      content: newCommentText.trim(),
      is_resolved: false,
    };

    setComments(prev => [...prev, newComment].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
    setLastSubmittedComment(newComment);
    setNewCommentText('');

    // Trigger the requested popup informing that this comment could be approved by the project owner!
    setIsApprovalModalOpen(true);
  };

  const handleRaffleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRaffleError(null);

    if (!raffleName.trim()) {
      setRaffleError('Please enter your name.');
      return;
    }
    if (!raffleEmail.trim() || !raffleEmail.includes('@')) {
      setRaffleError('Please enter a valid email address.');
      return;
    }

    setIsSubmittingRaffle(true);

    try {
      const res = await fetch('/api/raffle-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: raffleName.trim(),
          email: raffleEmail.trim().toLowerCase()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit raffle entry.');
      }

      setTicketNumber(data.entry?.ticket_number || `SCRUB-${Math.floor(1000 + Math.random() * 9000)}`);
      setRaffleSubmitted(true);
      localStorage.setItem('scrubmark_tour_completed', 'true');
    } catch (err: any) {
      setRaffleError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmittingRaffle(false);
    }
  };

  const activeComments = comments.filter(c => !c.is_resolved);
  const resolvedComments = comments.filter(c => c.is_resolved);

  const stepsList = [
    { num: 1, title: 'Introduction' },
    { num: 2, title: 'Add Video' },
    { num: 3, title: 'Sample Link' },
    { num: 4, title: 'Live Demo' },
    { num: 5, title: 'Raffle Entry' },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          {/* Brand & Back Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              title="Return to ScrubMark app"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-sm shadow-purple-600/30">
                <Video size={16} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-white tracking-tight text-base sm:text-lg">ScrubMark</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.5 rounded">
                  Demo
                </span>
              </div>
            </div>
          </div>

          {/* Stepper Tabs in Header */}
          <div className="hidden sm:flex items-center justify-center gap-1.5">
            {stepsList.map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40 ring-2 ring-purple-500/25'
                      : isPast
                        ? 'bg-purple-950/50 text-purple-300 hover:bg-purple-900/50 border border-purple-800/50'
                        : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200 border border-neutral-800/70'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-80">{step.num}</span>
                  <span className="hidden md:inline">{step.title}</span>
                </button>
              );
            })}
          </div>

          {/* Shareable Link Box */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-400 font-mono">
              <span className="text-neutral-500 mr-1.5">Link:</span>
              <span className="truncate max-w-[170px] text-neutral-300">
                {getFullDemoUrl()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPageUrl}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                copiedPageUrl 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200'
              }`}
              title="Copy link to this page to share"
            >
              {copiedPageUrl ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPageUrl ? 'Link Copied!' : 'Copy Page Link'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Stepper Bar */}
        <div className="sm:hidden border-t border-neutral-800/60 bg-neutral-950/90 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {stepsList.map((step) => (
              <button
                key={step.num}
                type="button"
                onClick={() => setCurrentStep(step.num)}
                className={`w-7 h-7 rounded-full text-xs font-mono font-medium flex items-center justify-center ${
                  currentStep === step.num
                    ? 'bg-purple-600 text-white'
                    : currentStep > step.num
                      ? 'bg-purple-950 text-purple-300'
                      : 'bg-neutral-900 text-neutral-500'
                }`}
              >
                {step.num}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono text-neutral-400">Step {currentStep}/5</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col ${currentStep === 4 ? 'w-full max-w-7xl mx-auto p-3 sm:p-5' : 'justify-center items-center max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12'}`}>
        
        {/* STEP 1: Introduction (Centered & Eye-Pleasing) */}
        {currentStep === 1 && (
          <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in duration-200 max-w-3xl mx-auto w-full">
            <div className="space-y-3">
              <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase bg-purple-950/70 border border-purple-800/50 px-3.5 py-1 rounded-full shadow-sm">
                Step 1: Introduction
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Video Review Without Friction
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto leading-relaxed">
                ScrubMark is a clean, minimal workspace for creators and clients. Review cuts frame-by-frame, scrub smoothly, and leave synchronized timestamped feedback with zero logins required for reviewers.
              </p>
            </div>

            {/* 3 Centered Value Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-center">
              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 flex flex-col items-center space-y-3 hover:border-purple-500/40 transition-colors shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold shadow-inner">
                  1
                </div>
                <h2 className="text-base font-semibold text-white">Frame Timestamps</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Pause anywhere to link notes directly to that exact second. Clicking any note instantly seeks the video.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 flex flex-col items-center space-y-3 hover:border-purple-500/40 transition-colors shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold shadow-inner">
                  2
                </div>
                <h2 className="text-base font-semibold text-white">Client Sharing</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Send clients a single link. They can scrub video cuts and leave notes without creating accounts or passwords.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 flex flex-col items-center space-y-3 hover:border-purple-500/40 transition-colors shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold shadow-inner">
                  3
                </div>
                <h2 className="text-base font-semibold text-white">Zero Upload Friction</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Paste public or unlisted YouTube links or Google Drive URLs. Skip multi-gigabyte uploads and re-renders.
                </p>
              </div>
            </div>

            {/* Centered Next Button */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-8 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-102"
              >
                <span>Let's Go</span>
                <ChevronRight size={16} />
              </button>
              <span className="text-xs text-neutral-500">Takes about 2 minutes to complete</span>
            </div>
          </div>
        )}

        {/* STEP 2: Adding a Video (Centered & Eye-Pleasing) */}
        {currentStep === 2 && (
          <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in duration-200 max-w-2xl mx-auto w-full">
            <div className="space-y-3">
              <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase bg-purple-950/70 border border-purple-800/50 px-3.5 py-1 rounded-full shadow-sm">
                Step 2: Adding a Video
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                How Creators Add Videos
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
                Starting a review room is instant. You don't have to upload massive video files. Simply paste an existing public or unlisted YouTube cut or Google Drive video URL.
              </p>
            </div>

            {/* Mock Form Preview */}
            <div className="p-6 sm:p-7 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 w-full text-left shadow-xl">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Project Title
                </label>
                <input
                  type="text"
                  disabled
                  value="Cyberpunk City Edit (Sample Cut)"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-neutral-200 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Video Source URL
                </label>
                <input
                  type="text"
                  disabled
                  value={SAMPLE_LINK}
                  className="w-full bg-neutral-950 border border-purple-500/50 rounded-lg px-3.5 py-2.5 text-xs text-purple-300 font-mono"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Supports unlisted YouTube videos or Google Drive shared review cuts.
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-7 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm shadow-purple-600/25"
              >
                <span>Next: Get Sample Link</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Sample Video Link & Automated Add Video Trigger */}
        {currentStep === 3 && (
          <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in duration-200 max-w-2xl mx-auto w-full">
            <div className="space-y-3">
              <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase bg-purple-950/70 border border-purple-800/50 px-3.5 py-1 rounded-full shadow-sm">
                Step 3: Sample Link
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Sample Video Link
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
                Click below to copy our test video cut. As soon as you copy the link, the <strong className="text-purple-300">Add Video popup</strong> will automatically appear so you can review details and add the cut before proceeding to the video!
              </p>
            </div>

            {/* Link Copy Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5 w-full shadow-xl">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Sample YouTube URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={SAMPLE_LINK}
                    onClick={handleCopySampleLink}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-neutral-200 font-mono select-all outline-none cursor-pointer hover:border-purple-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleCopySampleLink}
                    className="px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-neutral-200 shrink-0"
                  >
                    <Copy size={14} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              {/* Big Centered Action Button */}
              <button
                type="button"
                onClick={handleCopySampleLink}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 hover:scale-101"
              >
                <Copy size={16} />
                <span>{copiedLink ? 'Link Copied! Opening Add Video...' : 'Copy Link & Add Video'}</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 font-mono">
                <span>YouTube ID:</span>
                <span className="text-purple-400 font-bold">{SAMPLE_YT_ID}</span>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={triggerAddVideoModalWithSample}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-purple-600/25"
              >
                <Plus size={14} />
                <span>Add Video</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Live Interactive Demo Using THE ACTUAL MAIN WEBSITE REVIEW LAYOUT */}
        {currentStep === 4 && (
          <div className="w-full flex-1 flex flex-col space-y-3 animate-in fade-in duration-200 min-h-0">
            {/* Top Bar for Review Room inside Step 4 */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
                  ScrubMark
                </span>
                <h1 className="font-semibold text-white text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                  Cyberpunk City Edit (Sample Cut)
                </h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-medium transition-colors cursor-pointer border border-neutral-700/60"
                >
                  <Share2 size={13} className="text-purple-400" />
                  <span>Share</span>
                </button>

                <div className="hidden xs:flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <span className="text-neutral-200 font-medium">Tester</span>
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider">Client Reviewer</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <span>Finish & Raffle</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* The Actual Two-Panel Video Review Room Layout from VideoReview.tsx */}
            <div className="flex-1 flex flex-col md:flex-row min-h-[520px] md:min-h-[560px] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl bg-neutral-900">
              
              {/* Left Column: Full YouTube Video Player + Control Bar */}
              <div className="w-full md:flex-1 flex flex-col shrink-0 md:shrink relative bg-black">
                <div className="w-full aspect-video md:aspect-auto md:flex-1 relative bg-black flex items-center justify-center">
                  <YouTube
                    videoId={SAMPLE_YT_ID}
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        controls: 1, // Full native YouTube player controls (timeline scrubber, quality gear, sound slider)
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                      },
                    }}
                    onReady={onPlayerReady}
                    onStateChange={onPlayerStateChange}
                    className="absolute inset-0 w-full h-full"
                    iframeClassName="w-full h-full"
                  />
                  <div className="absolute top-3 left-3 pointer-events-none z-10">
                    <span className="px-2.5 py-1 rounded-lg bg-black/85 text-purple-300 font-mono text-xs border border-purple-500/30 shadow-sm backdrop-blur-xs">
                      {formatTime(currentTimestamp)}
                    </span>
                  </div>
                </div>

                {/* Reviewer Control Bar (Play/Pause, -5s, +5s, Timestamp, Keyboard Hints) */}
                <div className="h-11 sm:h-12 bg-neutral-950 border-t border-neutral-800 px-3 sm:px-4 flex items-center justify-between shrink-0 text-xs text-neutral-300">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      title="Play / Pause (Space)"
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                    >
                      {isPlaying ? <Pause size={14} className="text-purple-400" /> : <Play size={14} className="text-purple-400" />}
                      <span>{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => seekRelative(-5)}
                      title="Rewind 5s (←)"
                      className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                    >
                      <RotateCcw size={13} />
                      <span>-5s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => seekRelative(5)}
                      title="Forward 5s (→)"
                      className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs"
                    >
                      <RotateCw size={13} />
                      <span>+5s</span>
                    </button>

                    {/* Clickable / Editable Timestamp Indicator */}
                    {isEditingTime ? (
                      <form onSubmit={handleTimeInputSubmit} className="flex items-center gap-1 ml-1">
                        <input
                          type="text"
                          autoFocus
                          value={timeInputStr}
                          onChange={(e) => setTimeInputStr(e.target.value)}
                          onBlur={() => handleTimeInputSubmit()}
                          placeholder="0:15"
                          className="w-16 px-1.5 py-0.5 rounded bg-neutral-800 border border-purple-500 font-mono text-xs text-white outline-none"
                        />
                        <button type="submit" className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold px-1 cursor-pointer">Set</button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTimeInputStr(formatTime(currentTimestamp));
                          setIsEditingTime(true);
                        }}
                        title="Click to edit timestamp manually"
                        className="group flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-purple-300 font-mono text-xs ml-1 font-medium cursor-pointer transition-colors"
                      >
                        <span>{formatTime(currentTimestamp)}</span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-75" />
                      </button>
                    )}
                  </div>

                  <div className="hidden md:flex items-center gap-3 text-neutral-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">Space</kbd> Play/Pause
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">←</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] border border-neutral-700">→</kbd> Scrub 5s
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Review Notes Sidebar & Comment Composer (from VideoReview.tsx) */}
              <div className="w-full md:w-96 bg-neutral-900 md:border-l border-neutral-800 flex flex-col flex-1 md:flex-initial min-h-0 overflow-hidden">
                
                {/* Sidebar Header */}
                <div className="px-4 py-2.5 sm:py-3 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
                  <h2 className="font-semibold flex items-center gap-2 text-xs sm:text-sm text-white">
                    <MessageSquare size={15} className="text-purple-400" />
                    Review Notes
                  </h2>
                  <span className="text-xs font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/40">
                    {activeComments.length} Active
                  </span>
                </div>

                {/* Tutorial Prompt Banner: Encouraging user to leave a comment! */}
                <div className="p-3 bg-purple-950/40 border-b border-purple-500/30 flex items-start gap-2.5 text-xs text-purple-200">
                  <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <p className="font-semibold text-purple-300">Tutorial Task:</p>
                    <p className="text-[11px] text-purple-200/90 leading-relaxed">
                      Pause the video at any frame and type a note below to test real-time feedback submission!
                    </p>
                  </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                  <div>
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2.5 px-1">
                      Active Notes ({activeComments.length})
                    </h3>
                    <div className="space-y-2">
                      {activeComments.length === 0 && (
                        <p className="text-xs sm:text-sm text-neutral-500 italic px-1">No active notes.</p>
                      )}
                      {activeComments.map(comment => (
                        <div
                          key={comment.id}
                          onClick={() => jumpToTime(comment.timestamp_seconds)}
                          className="group bg-neutral-800/60 hover:bg-neutral-800 p-3 rounded-xl border border-neutral-700/60 hover:border-purple-500/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 text-xs font-mono font-semibold border border-purple-800/50">
                                {formatTime(comment.timestamp_seconds)}
                              </span>
                              <span className="text-xs font-medium text-neutral-300">{comment.author_name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                resolveComment(comment.id);
                              }}
                              className="p-1 -m-1 text-neutral-500 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Resolve Note"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                          <p className="text-xs sm:text-sm text-neutral-200 text-left">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resolved Notes */}
                  {resolvedComments.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        Resolved ({resolvedComments.length})
                      </h3>
                      <div className="space-y-2">
                        {resolvedComments.map(comment => (
                          <div
                            key={comment.id}
                            onClick={() => jumpToTime(comment.timestamp_seconds)}
                            className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 cursor-pointer opacity-60 hover:opacity-85 transition-opacity"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-xs font-mono font-medium">
                                {formatTime(comment.timestamp_seconds)}
                              </span>
                              <span className="text-xs font-medium text-neutral-500 line-through">{comment.author_name}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-400 line-through text-left">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Comment Composer at Bottom of Sidebar */}
                <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950 shrink-0">
                  <form onSubmit={handlePostReviewComment} className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-neutral-500">At:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTimeInputStr(formatTime(currentTimestamp));
                            setIsEditingTime(true);
                          }}
                          title="Click to edit timestamp"
                          className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 text-xs font-mono font-medium hover:bg-purple-900/60 transition-colors flex items-center gap-1 cursor-pointer border border-purple-800/50"
                        >
                          <span>{formatTime(currentTimestamp)}</span>
                          <Edit3 size={10} className="opacity-70" />
                        </button>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        As: <strong className="text-neutral-300 font-medium">You (Tester)</strong>
                      </span>
                    </div>

                    <textarea
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (newCommentText.trim()) {
                            handlePostReviewComment(e);
                          }
                        }
                      }}
                      placeholder="Leave a feedback note or question..."
                      rows={2}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-purple-500 rounded-lg p-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 resize-none outline-none transition-colors"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-neutral-500 font-mono">Press Enter to send</span>
                      <button
                        type="submit"
                        disabled={!newCommentText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm shadow-purple-600/25"
                      >
                        Post Note
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Bottom Step 4 Navigation Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back to Step 3</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm shadow-purple-600/30"
              >
                <span>Proceed to Raffle Entry</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Research Raffle Entry (Centered, Eye-Pleasing, Google Forms Wording) */}
        {currentStep === 5 && (
          <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-200 w-full flex flex-col items-center">
            {!raffleSubmitted ? (
              <div className="flex flex-col items-center text-center space-y-6 w-full">
                <div className="space-y-3">
                  <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase bg-purple-950/70 border border-purple-800/50 px-3.5 py-1 rounded-full shadow-sm">
                    Final Step: Raffle Entry
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Thank you for testing out our page!
                  </h1>
                  <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
                    Please enter your name and email here so we can contact you if you win our raffle! Once submitted, you'll receive a code — make sure to enter the code into the google forms to be eligible ! hehe
                  </p>
                </div>

                {/* Eligibility Reminder Banner */}
                <div className="w-full p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-xs leading-relaxed text-center shadow-md">
                  💡 <strong>Important:</strong> After submitting, you will receive a raffle code. Make sure to enter the code into the google forms to be eligible !
                </div>

                <form onSubmit={handleRaffleSubmit} className="p-6 sm:p-8 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 w-full text-left shadow-xl">
                  {raffleError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs">
                      {raffleError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name"
                      value={raffleName}
                      onChange={(e) => setRaffleName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={raffleEmail}
                      onChange={(e) => setRaffleEmail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingRaffle || !raffleName.trim() || !raffleEmail.trim()}
                    className="w-full mt-2 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 text-white font-medium text-sm transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                  >
                    {isSubmittingRaffle ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Submit & Generate Code</span>
                    )}
                  </button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors cursor-pointer"
                  >
                    ← Review demo player again
                  </button>
                </div>
              </div>
            ) : (
              /* Success / Ticket Confirmation */
              <div className="w-full p-8 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-purple-950 border border-purple-800/80 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
                  <Check size={28} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Entry Confirmed!
                  </h2>
                  <div className="p-4 rounded-xl bg-purple-950/70 border border-purple-500/50 text-purple-200 text-xs sm:text-sm font-semibold leading-relaxed shadow-sm">
                    📋 Make sure you enter the code into the google forms to be eligible ! hehe
                  </div>
                </div>

                {ticketNumber && (
                  <div className="p-5 rounded-2xl bg-neutral-950 border border-purple-500/60 inline-flex flex-col items-center gap-2.5 min-w-[280px] shadow-xl">
                    <div className="text-[10px] text-purple-400 uppercase tracking-widest font-mono">
                      Your Raffle Code
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-wider select-all">
                      {ticketNumber}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {raffleEmail}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyTicket}
                      className={`mt-2 px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        copiedTicket ? 'bg-purple-600 text-white shadow-md' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                      }`}
                    >
                      {copiedTicket ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedTicket ? 'Code Copied!' : 'Copy Code for Google Forms'}</span>
                    </button>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onExit}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Go to Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRaffleSubmitted(false);
                      setCurrentStep(1);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Restart Demo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* POPUP 1: AUTOMATIC ADD VIDEO MODAL */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  <Plus size={16} />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Add Video for Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVideoModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Notification badge */}
            <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center gap-2 text-xs text-purple-300">
              <Sparkles size={14} className="text-purple-400 shrink-0" />
              <span>Link copied! Review project cut details and click Add Video to launch review:</span>
            </div>

            <form onSubmit={handleConfirmAddVideo} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={projectNameInput}
                  onChange={(e) => setProjectNameInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Video URL
                </label>
                <input
                  type="url"
                  required
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-purple-500/50 rounded-lg px-3.5 py-2.5 text-xs text-purple-300 font-mono outline-none focus:border-purple-500 transition-colors"
                />
                <p className="text-[11px] text-neutral-500">
                  YouTube video cut is ready for instant frame-by-frame review.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddVideoModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-850 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isAddingVideo}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium text-xs transition-colors cursor-pointer shadow-md shadow-purple-600/25 flex items-center gap-1.5"
                >
                  {isAddingVideo ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Ingesting Video...</span>
                    </>
                  ) : (
                    <>
                      <span>Add Video & Launch Review</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 2: COMMENT SUBMITTED & APPROVAL NOTICE (Requested by user) */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-950 border border-purple-800/80 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={26} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Comment Submitted!
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Your feedback note at <strong className="text-purple-300 font-mono">{lastSubmittedComment ? formatTime(lastSubmittedComment.timestamp_seconds) : '0:15'}</strong> has been recorded.
              </p>
            </div>

            {/* Approval notice box */}
            <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-xs text-left space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-purple-300">
                <Sparkles size={14} />
                <span>Approval Workflow Notice</span>
              </div>
              <p className="text-[11px] text-purple-200/90 leading-relaxed">
                In the main website, this comment you just left can be <strong>reviewed and approved</strong> by the project owner once the revision is complete!
              </p>
            </div>

            {lastSubmittedComment && (
              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-left space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-purple-300 font-semibold">{formatTime(lastSubmittedComment.timestamp_seconds)}</span>
                  <span className="text-neutral-500">{lastSubmittedComment.author_name}</span>
                </div>
                <p className="text-xs text-neutral-300 truncate">"{lastSubmittedComment.content}"</p>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setCurrentStep(5);
                }}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5"
              >
                <span>Next: Enter Raffle</span>
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Keep Testing Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: SHARE MODAL (Matches VideoReview.tsx) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Share2 size={14} />
                </div>
                <h3 className="text-sm font-bold text-white">Share Review Room</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Anyone with this link can review the video cut, scrub frames, and leave feedback notes without creating an account.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Client Review Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?v=sample-cut-demo`}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                    copiedShareUrl ? 'bg-purple-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  }`}
                >
                  {copiedShareUrl ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Centered Footer */}
      <footer className="border-t border-neutral-800/80 py-5 px-4 text-center text-xs text-neutral-500 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ScrubMark — Frame-Accurate Video Review</span>
          <div className="flex items-center gap-4 text-neutral-400">
            <button
              onClick={handleCopyPageUrl}
              className="hover:text-purple-400 transition-colors cursor-pointer"
            >
              {copiedPageUrl ? 'Link Copied!' : 'Copy Shareable Link'}
            </button>
            <button
              onClick={onExit}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Main App
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
