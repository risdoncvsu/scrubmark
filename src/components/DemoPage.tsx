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
  Plus,
  X,
  Sparkles,
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/95 sticky top-0 z-30 backdrop-blur-md">
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

        {/* Centered Stepper Tabs */}
        <div className="border-t border-neutral-800/60 bg-neutral-950/90 px-4 sm:px-6 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center justify-between sm:justify-center relative">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
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

            <div className="text-xs text-neutral-500 font-mono sm:absolute sm:right-0">
              Step {currentStep}/5
            </div>
          </div>
        </div>
      </header>

      {/* Main Centered Stage */}
      <main className="flex-1 flex flex-col justify-center items-center max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
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

        {/* STEP 4: Live Interactive Player Demo (Centered & Eye-Pleasing) */}
        {currentStep === 4 && (
          <div className="space-y-7 animate-in fade-in duration-200 w-full max-w-3xl mx-auto flex flex-col items-center">
            {/* Centered Header */}
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase bg-purple-950/70 border border-purple-800/50 px-3.5 py-1 rounded-full shadow-sm">
                Step 4: Interactive Demo
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Timestamping & Client Sharing Demo
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Test the timeline controls: click timestamp badges to seek to exact frames, add a test comment, or copy the client review share link.
              </p>
            </div>

            {/* Centered Video Player Stage */}
            <div className="w-full space-y-4 flex flex-col items-center">
              <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-neutral-800 relative shadow-2xl shadow-purple-950/30">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${SAMPLE_YT_ID}?autoplay=0&controls=1&rel=0`}
                  title="Sample Research Video"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
                <div className="absolute top-3 left-3 pointer-events-none">
                  <span className="px-2.5 py-1 rounded-lg bg-black/85 text-purple-300 font-mono text-xs border border-purple-500/30 shadow-sm backdrop-blur-xs">
                    {formatTime(demoTimestamp)}
                  </span>
                </div>
              </div>

              {/* Centered Timeline Seeker Buttons */}
              <div className="w-full p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Seek Timeline By Timestamp:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[15, 30, 42, 60, 78].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setDemoTimestamp(sec);
                        const match = demoComments.find(c => Math.abs(c.timestamp - sec) < 5);
                        if (match) setDemoActiveCommentId(match.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                        demoTimestamp === sec
                          ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-600/30 scale-105'
                          : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-750'
                      }`}
                    >
                      {formatTime(sec)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Centered Share Link Card */}
              <div className="w-full p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Share2 size={14} className="text-purple-400" />
                    Client Review Share Link
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono uppercase bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/40">
                    No Login Required
                  </span>
                </div>
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
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      copiedShareUrl 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                    }`}
                  >
                    {copiedShareUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Centered Synced Comments Card */}
              <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/80 flex flex-col overflow-hidden shadow-xl">
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-purple-400" />
                    Synced Notes ({demoComments.length})
                  </span>
                  <span className="text-[11px] text-purple-400 font-mono">Real-time Feed</span>
                </div>

                {/* Notes List */}
                <div className="p-4 space-y-2.5 overflow-y-auto max-h-[260px]">
                  {demoComments.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setDemoTimestamp(c.timestamp);
                        setDemoActiveCommentId(c.id);
                      }}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        demoActiveCommentId === c.id
                          ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-sm'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
                          {formatTime(c.timestamp)}
                        </span>
                        <span className="text-neutral-400">{c.author}</span>
                      </div>
                      <p className="text-neutral-200 leading-relaxed text-left">{c.text}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleAddDemoComment} className="p-3.5 border-t border-neutral-800 bg-neutral-950/60 space-y-2">
                  <div className="text-[11px] text-neutral-400 flex items-center justify-between px-1">
                    <span>Add note at timestamp:</span>
                    <span className="font-mono text-purple-300 font-medium">{formatTime(demoTimestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={demoNewCommentText}
                      onChange={(e) => setDemoNewCommentText(e.target.value)}
                      placeholder="Type feedback note..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!demoNewCommentText.trim()}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Post Note
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-4 flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-7 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-sm shadow-purple-600/30"
              >
                <span>Next: Enter Raffle</span>
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

      {/* AUTOMATIC POPUP: ADD VIDEO MODAL ("add video thingy, before the actual video") */}
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

      {/* Minimalist Centered Footer */}
      <footer className="border-t border-neutral-800/80 py-6 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
