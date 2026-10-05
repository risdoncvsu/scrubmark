import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Copy, 
  Check, 
  MessageSquare,
  Share2,
  Video,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { formatTime } from '../utils';

interface DemoPageProps {
  onExit: () => void;
  onAutoAddVideo?: (projectName: string, videoUrl: string) => Promise<string | void>;
  onSelectVideo?: (videoId: string) => void;
  initialStep?: number;
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
  const [isSubmittingRaffle, setIsSubmittingRaffle] = useState(false);
  const [raffleSubmitted, setRaffleSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [raffleError, setRaffleError] = useState<string | null>(null);

  // Form State: strictly Name and Email only
  const [raffleName, setRaffleName] = useState('');
  const [raffleEmail, setRaffleEmail] = useState('');

  // Interactive Demo State for Step 4
  const [demoTimestamp, setDemoTimestamp] = useState(15);
  const [demoActiveCommentId, setDemoActiveCommentId] = useState<string>('c1');
  const [demoNewCommentText, setDemoNewCommentText] = useState('');
  const [demoComments, setDemoComments] = useState([
    { id: 'c1', timestamp: 15, author: 'Alex (Director)', text: 'Trim this opening shot by 12 frames to tighten pacing.' },
    { id: 'c2', timestamp: 42, author: 'Maya (Colorist)', text: 'Skin tones are slightly magenta here; adjust saturation.' },
    { id: 'c3', timestamp: 78, author: 'Sarah (Client)', text: 'The title card looks great, can we hold it for 1 more second?' },
  ]);

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

  const getFullDemoUrl = () => {
    if (typeof window === 'undefined') return 'https://scrubmark.com/demo';
    return `${window.location.origin}/demo`;
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

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  const handleCopySampleLink = () => {
    navigator.clipboard.writeText(SAMPLE_LINK).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      fallbackCopy(SAMPLE_LINK);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
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

  const handleQuickAddProject = async () => {
    if (onAutoAddVideo) {
      try {
        const vidId = await onAutoAddVideo('Cyberpunk City Edit (Sample Cut)', SAMPLE_LINK);
        if (vidId && onSelectVideo) {
          onSelectVideo(vidId);
          return;
        }
      } catch (e) {
        console.error('Auto-add error:', e);
      }
    }
    setCurrentStep(4);
  };

  const handleAddDemoComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoNewCommentText.trim()) return;

    const newComment = {
      id: 'c_' + Date.now(),
      timestamp: demoTimestamp,
      author: 'You (Tester)',
      text: demoNewCommentText.trim(),
    };

    setDemoComments(prev => [...prev, newComment].sort((a, b) => a.timestamp - b.timestamp));
    setDemoActiveCommentId(newComment.id);
    setDemoNewCommentText('');
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

  const stepsList = [
    { num: 1, title: 'Introduction' },
    { num: 2, title: 'Add Video' },
    { num: 3, title: 'Sample Link' },
    { num: 4, title: 'Live Demo' },
    { num: 5, title: 'Raffle Entry' },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-neutral-800 bg-neutral-950/90 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
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
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-sm">
                <Video size={16} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-white tracking-tight text-base sm:text-lg">ScrubMark</span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.5 rounded">
                  Interactive Demo
                </span>
              </div>
            </div>
          </div>

          {/* Shareable Link Box (Copy & Paste) */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-400 font-mono">
              <span className="text-neutral-500 mr-1.5">Link:</span>
              <span className="truncate max-w-[180px] md:max-w-[240px] text-neutral-300">
                {getFullDemoUrl()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPageUrl}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                copiedPageUrl 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200'
              }`}
              title="Copy link to this page to share"
            >
              {copiedPageUrl ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPageUrl ? 'Link Copied!' : 'Copy Page Link'}</span>
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="border-t border-neutral-800/60 bg-neutral-950 px-4 sm:px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              {stepsList.map((step) => {
                const isActive = currentStep === step.num;
                const isPast = currentStep > step.num;
                return (
                  <button
                    key={step.num}
                    type="button"
                    onClick={() => setCurrentStep(step.num)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : isPast
                          ? 'bg-purple-950/40 text-purple-300 hover:bg-purple-900/40 border border-purple-900/40'
                          : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200 border border-neutral-800/70'
                    }`}
                  >
                    <span className="font-mono text-[11px] opacity-80">{step.num}</span>
                    <span className="hidden md:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-neutral-500 font-mono">
              Step {currentStep} of 5
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* STEP 1: Introduction */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Step 1: Introduction
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                Video Review Without Friction
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                ScrubMark is a clean, minimal workspace for creators, video editors, and clients. Review cuts frame-by-frame, scrub smoothly, and leave synchronized timestamped feedback with zero logins required for reviewers.
              </p>
            </div>

            {/* 3 Value Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold">
                  1
                </div>
                <h2 className="text-base font-semibold text-white">Frame Timestamps</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Pause anywhere to link notes directly to that exact second. Clicking any note instantly seeks the video to that moment.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold">
                  2
                </div>
                <h2 className="text-base font-semibold text-white">Client Sharing</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Send clients a single link. They can scrub through video cuts and comment directly in their web browser without creating accounts.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 flex items-center justify-center font-mono text-sm font-semibold">
                  3
                </div>
                <h2 className="text-base font-semibold text-white">Zero Upload Friction</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Paste public or unlisted YouTube links or Google Drive URLs. Skip multi-gigabyte uploads and re-rendering delays.
                </p>
              </div>
            </div>

            {/* Step Action Bottom Bar */}
            <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                Quick 2-minute walkthrough & raffle entry
              </span>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <span>Let's Go</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Adding a Video */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Step 2: Adding a Video
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                How Creators Add Videos
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                Starting a review room is instant. You don't have to upload video files. Simply paste an existing public or unlisted YouTube cut or Google Drive video URL.
              </p>
            </div>

            {/* Mock Form Preview */}
            <div className="p-6 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4 max-w-xl">
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
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={SAMPLE_LINK}
                    className="w-full bg-neutral-950 border border-purple-500/50 rounded-lg px-3.5 py-2.5 text-xs text-purple-300 font-mono"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Supports unlisted YouTube videos or Google Drive shared review cuts.
                </p>
              </div>
            </div>

            {/* Step Action Bottom Bar */}
            <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <span>Next: Get Sample Link</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Sample Video Link */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Step 3: Sample Link
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                Sample Video Link
              </h1>
              <p className="text-sm sm:text-base text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                We've prepared a sample video cut for testing. Copy this link to try it manually in the dashboard, or proceed to test the interactive player demo on the next step:
              </p>
            </div>

            {/* Link Copy Card */}
            <div className="p-6 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4 max-w-xl">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Sample YouTube URL
              </label>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={SAMPLE_LINK}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-neutral-200 font-mono select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopySampleLink}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    copiedLink 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  }`}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>

              <div className="text-[11px] text-neutral-500 font-mono">
                YouTube ID: <span className="text-purple-400">{SAMPLE_YT_ID}</span>
              </div>
            </div>

            {/* Step Action Bottom Bar */}
            <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleQuickAddProject}
                  className="px-4 py-2.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors cursor-pointer hidden sm:inline-flex"
                >
                  Add to My Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <span>Next: Try Live Demo</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Live Interactive Player & Timestamp Demo */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                Step 4: Interactive Demo
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                Timestamping & Client Sharing Demo
              </h1>
              <p className="text-sm text-neutral-400 mt-1 leading-relaxed max-w-2xl">
                Test the timeline controls below: click timestamp badges to jump to exact frames, add a test comment, or copy the client review share link.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Player & Seeker (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="aspect-video w-full bg-black rounded-xl overflow-hidden border border-neutral-800 relative">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}?autoplay=0&controls=1&rel=0`}
                    title="Sample Research Video"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span className="px-2.5 py-1 rounded bg-black/85 text-purple-300 font-mono text-xs border border-purple-500/30">
                      {formatTime(demoTimestamp)}
                    </span>
                  </div>
                </div>

                {/* Timestamp Jump Pills */}
                <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Seek Timeline By Timestamp:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[15, 30, 42, 60, 78].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setDemoTimestamp(sec);
                          const match = demoComments.find(c => Math.abs(c.timestamp - sec) < 5);
                          if (match) setDemoActiveCommentId(match.id);
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                          demoTimestamp === sec
                            ? 'bg-purple-600 text-white font-semibold shadow-sm'
                            : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-750'
                        }`}
                      >
                        {formatTime(sec)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Share Link Preview Card */}
                <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Share2 size={13} className="text-purple-400" />
                      Client Review Share Link
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono uppercase bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                      No Login Required
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/?v=sample-cut-demo`}
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 font-mono select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                        copiedShareUrl 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                      }`}
                    >
                      {copiedShareUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Synced Comments & New Note Form (5 cols) */}
              <div className="lg:col-span-5 rounded-xl border border-neutral-800 bg-neutral-900/70 flex flex-col overflow-hidden">
                <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-purple-400" />
                    Synced Notes ({demoComments.length})
                  </span>
                  <span className="text-[11px] text-purple-400 font-mono">Live</span>
                </div>

                {/* Notes List */}
                <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto max-h-[300px]">
                  {demoComments.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setDemoTimestamp(c.timestamp);
                        setDemoActiveCommentId(c.id);
                      }}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        demoActiveCommentId === c.id
                          ? 'bg-purple-950/30 border-purple-500/60 text-white'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-purple-300">
                          {formatTime(c.timestamp)}
                        </span>
                        <span className="text-neutral-500">{c.author}</span>
                      </div>
                      <p className="text-neutral-200 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleAddDemoComment} className="p-3.5 border-t border-neutral-800 bg-neutral-950/50 space-y-2">
                  <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                    <span>Add note at timestamp:</span>
                    <span className="font-mono text-purple-300 font-medium">{formatTime(demoTimestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={demoNewCommentText}
                      onChange={(e) => setDemoNewCommentText(e.target.value)}
                      placeholder="Type feedback note..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!demoNewCommentText.trim()}
                      className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Post
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Step Action Bottom Bar */}
            <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <span>Next: Enter Raffle</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Research Raffle Entry */}
        {/* User requirement: "for the last part, it should only be name and email." */}
        {/* User requirement: "thank you for testing out our page, please enter your name and email here so we can contact you if you win our raffle!" */}
        {currentStep === 5 && (
          <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-200">
            {!raffleSubmitted ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    Final Step
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Thank you for testing out our page!
                  </h1>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Please enter your name and email here so we can contact you if you win our raffle!
                  </p>
                </div>

                <form onSubmit={handleRaffleSubmit} className="p-6 sm:p-8 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-4">
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
                    className="w-full mt-2 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-sm transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    {isSubmittingRaffle ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Submit Raffle Entry</span>
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
              <div className="p-8 rounded-xl bg-neutral-900/70 border border-neutral-800 text-center space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-purple-950 border border-purple-800/80 text-purple-400 flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-white">
                    Entry Confirmed!
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    We've saved your details for the participant research raffle drawing.
                  </p>
                </div>

                {ticketNumber && (
                  <div className="p-4 rounded-lg bg-neutral-950 border border-purple-500/40 inline-block min-w-[220px]">
                    <div className="text-[10px] text-purple-400 uppercase tracking-widest font-mono">
                      Raffle Ticket
                    </div>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">
                      {ticketNumber}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {raffleEmail}
                    </div>
                  </div>
                )}

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onExit}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Go to Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRaffleSubmitted(false);
                      setCurrentStep(1);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    Restart Demo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Minimalist Footer */}
      <footer className="border-t border-neutral-800/80 py-6 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
