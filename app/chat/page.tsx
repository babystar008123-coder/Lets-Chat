"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Smile,
  Video,
  Phone,
  Search,
  Paperclip,
  Heart,
  Globe,
  UserCheck,
  Mic,
  MicOff,
  PhoneOff,
  VideoOff,
  Sparkles,
  ArrowRight,
  Radio,
  Copy,
  Check,
  MessageCircle,
  Laugh,
  Flame,
  MessageSquareQuote,
  Menu,
  X,
  Volume2,
  UserPlus,
  ShieldCheck,
  Bell,
  Camera,
  User,
  Settings,
  Lock,
  Smartphone,
  KeyRound,
  LogOut,
  AlertCircle,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  where,
  runTransaction,
  getDocs,
} from "firebase/firestore";

// ==========================================
// 1. INLINE SYNTHESIZED NOTIFICATION AUDIO CHIME
// ==========================================
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Audio playback:", e);
  }
}

// Trigger Mobile System Notification (Works when app is minimized/screen locked)
function triggerMobileSystemNotification(title: string, body: string, icon?: string) {
  playNotificationChime();

  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const options: any = {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: "lets-chat-message",
        
      };

      const notif = new Notification(title, options);

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          (reg as any).showNotification(title, {
            body,
            icon: icon || "/favicon.ico",
            badge: "/favicon.ico",
          });
        });
      }
    }
  }
}
// ==========================================
// 2. INLINE AGORA WEBRTC ENGINE
// ==========================================
const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

function useInlineAgora() {
  const [client, setClient] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    let agoraClient: any = null;
    const init = async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setClient(agoraClient);

        agoraClient.on("user-published", async (user: any, mediaType: string) => {
          await agoraClient.subscribe(user, mediaType);
          if (mediaType === "video") {
            setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        agoraClient.on("user-unpublished", (user: any, mediaType: string) => {
          if (mediaType === "video") {
            setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          }
        });

        agoraClient.on("user-left", (user: any) => {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });
      } catch (err) {
        console.warn("Agora initialization:", err);
      }
    };

    init();

    return () => {
      localAudioTrack?.close();
      localVideoTrack?.close();
      agoraClient?.leave();
    };
  }, []);

  const startCall = async (channelName: string, isVideo: boolean = true) => {
    if (!client || !AGORA_APP_ID) {
      alert("Add NEXT_PUBLIC_AGORA_APP_ID in .env.local to enable live WebRTC calling!");
      return;
    }
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      await client.join(AGORA_APP_ID, channelName, null, null);

      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      setLocalAudioTrack(audioTrack);

      if (isVideo) {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        setLocalVideoTrack(videoTrack);
        await client.publish([audioTrack, videoTrack]);
        setIsVideoEnabled(true);
      } else {
        await client.publish([audioTrack]);
        setIsVideoEnabled(false);
      }
      setJoined(true);
    } catch (e) {
      console.error("Call error:", e);
    }
  };

  const endCall = async () => {
    localAudioTrack?.stop();
    localAudioTrack?.close();
    localVideoTrack?.stop();
    localVideoTrack?.close();
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setJoined(false);
    if (client) await client.leave();
  };

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setEnabled(isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  return {
    joined,
    localVideoTrack,
    remoteUsers,
    isVideoEnabled,
    isAudioMuted,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}

// ==========================================
// 3. ROMANTIC NEON HEART PARTICLES SHOWER
// ==========================================
interface HeartParticle {
  id: number;
  x: number;
  size: number;
  duration: number;
  emoji: string;
}

function InlineHeartShower({ trigger }: { trigger: number }) {
  const [hearts, setHearts] = useState<HeartParticle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const emojis = ["❤️", "💖", "💕", "💘", "🌹", "✨", "😍", "💋", "🔥", "💙"];
    const newItems: HeartParticle[] = Array.from({ length: 18 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 85 + 5,
      size: Math.random() * 16 + 22,
      duration: Math.random() * 1.5 + 1.8,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));

    setHearts((prev) => [...prev, ...newItems]);
    const timer = setTimeout(() => setHearts([]), 3500);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 1, y: "105vh", x: `${h.x}vw`, scale: 0.4 }}
            animate={{
              opacity: [1, 1, 0],
              y: "-15vh",
              x: `${h.x + (Math.random() * 12 - 6)}vw`,
              scale: [0.4, 1.3, 1],
              rotate: [0, Math.random() * 40 - 20],
            }}
            transition={{ duration: h.duration, ease: "easeOut" }}
            style={{ fontSize: `${h.size}px` }}
            className="absolute bottom-0 select-none filter drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]"
          >
            {h.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 4. INLINE CALL HUD MODAL
// ==========================================
function InlineCallModal({
  channelName,
  isVideo,
  onEndCall,
  localVideoTrack,
  remoteUsers,
  isAudioMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
}: any) {
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localVideoTrack && localRef.current) {
      localVideoTrack.play(localRef.current);
    }
  }, [localVideoTrack]);

  useEffect(() => {
    const remote = remoteUsers[0];
    if (remote?.videoTrack && remoteRef.current) {
      remote.videoTrack.play(remoteRef.current);
    }
  }, [remoteUsers]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-6">
      <div className="relative w-full max-w-4xl h-[85vh] sm:h-[80vh] bg-slate-950 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.2)] flex flex-col justify-between border border-sky-500/30">
        <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
          {remoteUsers.length > 0 && isVideo ? (
            <div ref={remoteRef} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-slate-100 space-y-3 p-4">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 flex items-center justify-center mx-auto text-3xl font-black text-white shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse">
                LC
              </div>
              <p className="text-base font-bold text-slate-200">Room: {channelName}</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                {remoteUsers.length > 0 ? "Cyber Stream Connected" : "Dialing..."}
              </div>
            </div>
          )}

          {isVideo && (
            <div
              ref={localRef}
              className="absolute bottom-4 right-4 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-rose-500 shadow-2xl bg-slate-900"
            />
          )}
        </div>

        <div className="h-20 bg-slate-950/90 backdrop-blur-md flex items-center justify-center gap-4 px-6 border-t border-slate-800">
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-2xl transition-all ${
              isAudioMuted ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40" : "bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
            }`}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-2xl transition-all ${
                !isVideoEnabled ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40" : "bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {!isVideoEnabled ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}

          <button
            onClick={onEndCall}
            className="p-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-transform active:scale-95"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. REAL TAMIL CINEMA MEMES & SYNCED DIALOGUES
// ==========================================
interface TamilMeme {
  id: string;
  url: string;
  actor: string;
  movie: string;
  quote: string;
  tag: "comedy" | "romance" | "punch" | "dialogues";
  badgeColor: string;
}

const TAMIL_VAULT: TamilMeme[] = [
  {
    id: "vadivelu_winner",
    actor: "Vadivelu",
    movie: "Winner (Kaipulla)",
    quote: "Venaam... Valikidhu... Azhudhuduven! Enna vittudunga da!",
    tag: "comedy",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "vadivelu_chandramukhi",
    actor: "Vadivelu",
    movie: "Chandramukhi",
    quote: "Maapla! Vechittanya aappu! Naan apdiye shock aayitten!",
    tag: "comedy",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "vadivelu_friends",
    actor: "Vadivelu",
    movie: "Friends (Nesamani)",
    quote: "Aani pudunga venaam! Vechittu kelambu!",
    tag: "comedy",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "goundamani_suriyan",
    actor: "Goundamani & Senthil",
    movie: "Suriyan",
    quote: "Arasiyalla idhellam saadharanamappa! Phone pottu kettu solren!",
    tag: "comedy",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "santhanam_boss",
    actor: "Santhanam",
    movie: "Boss Engira Bhaskaran",
    quote: "Nanbenda! Endha naalaiku naan unna kaappaathama irundhuruken?",
    tag: "comedy",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "vijay_kushi",
    actor: "Thalapathy Vijay",
    movie: "Kushi",
    quote: "Chellame... Un kooda pesumbodhu mattum dhaan ulagame marakkudhu ❤️",
    tag: "romance",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "surya_vtv",
    actor: "Suriya",
    movie: "Vaaranam Aayiram",
    quote: "En melodiku nee dhaan lyrical partner... Nee illama ennala mudiyadhu!",
    tag: "romance",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "dhanush_3",
    actor: "Dhanush",
    movie: "3 (Moonu)",
    quote: "Kannazhaga... Kaalazhaga... En uyir nee dhaan di!",
    tag: "romance",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "rajini_baasha",
    actor: "Superstar Rajinikanth",
    movie: "Baasha",
    quote: "Naan oru thadava sonna, nooru thadava sonna maadhiri! 🔥",
    tag: "punch",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "ajith_mankatha",
    actor: "Thala Ajith",
    movie: "Mankatha",
    quote: "This is my game... And I play it my way! No rules!",
    tag: "punch",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "kamal_vikram",
    actor: "Kamal Haasan",
    movie: "Vikram",
    quote: "Aarambikkalaangala? Paathukalam!",
    tag: "punch",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "dial_love",
    actor: "Romantic Vibes",
    movie: "Love Pulse",
    quote: "Un kooda pesina dhaan en day complete aagum di pattu ❤️",
    tag: "dialogues",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "dial_anger",
    actor: "Playful Fight",
    movie: "Cute Anger",
    quote: "En kooda pesaama irundha kola panirven paathukko! 😤",
    tag: "dialogues",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80",
  },
];

// ==========================================
// 6. BOTTOM SHEET MEME DRAWER
// ==========================================
function MobileMemeBottomSheet({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: TamilMeme) => void;
}) {
  const [activeTab, setActiveTab] = useState<"comedy" | "romance" | "punch" | "dialogues">("comedy");
  const filtered = TAMIL_VAULT.filter((m) => m.tag === activeTab);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="fixed bottom-0 inset-x-0 max-h-[82vh] bg-slate-950 border-t border-sky-500/30 rounded-t-[32px] shadow-[0_-10px_50px_rgba(0,0,0,0.95)] z-50 flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3" />

            <div className="px-4 pb-3 border-b border-slate-900 flex items-center justify-between">
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 flex-1 mr-2">
                {(
                  [
                    { key: "comedy", label: "Comedy", icon: Laugh },
                    { key: "romance", label: "Love", icon: Heart },
                    { key: "punch", label: "Punch", icon: Flame },
                    { key: "dialogues", label: "Dial", icon: MessageSquareQuote },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-rose-500 to-sky-500 text-white shadow-md shadow-rose-500/30"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={onClose} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[62vh]">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="cursor-pointer group flex flex-col p-2.5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/60 transition-all shadow-sm active:scale-95"
                >
                  <div className="relative aspect-video sm:aspect-square rounded-xl overflow-hidden mb-2 bg-black">
                    <img
                      src={item.url}
                      alt={item.actor}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border backdrop-blur-md ${item.badgeColor}`}>
                      {item.actor}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-200 font-semibold italic line-clamp-2 leading-snug">
                    "{item.quote}"
                  </p>
                  <p className="text-[10px] text-sky-400 font-bold mt-1">{item.movie}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==========================================
// 7. PROFILE EDITOR MODAL
// ==========================================
function ProfileModal({
  isOpen,
  onClose,
  myFancyNumber,
  myAvatar,
  myName,
  myPhone,
  onUpdateProfile,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  myFancyNumber: string;
  myAvatar: string;
  myName: string;
  myPhone: string;
  onUpdateProfile: (name: string, avatar: string) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(myName);
  const [avatar, setAvatar] = useState(myAvatar);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(myName);
    setAvatar(myAvatar);
  }, [myName, myAvatar]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    onUpdateProfile(name.trim() || myFancyNumber, avatar);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-6 shadow-2xl relative"
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>

            <h3 className="text-lg font-black text-white text-center mb-1">Your Permanent Profile</h3>
            <p className="text-xs text-sky-400 font-mono text-center mb-1 font-bold">Fixed ID: {myFancyNumber}</p>
            <p className="text-[11px] text-slate-400 font-mono text-center mb-4">Phone: +91 {myPhone}</p>

            <div className="flex flex-col items-center mb-5">
              <div
                onClick={() => avatarFileRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer group bg-black"
              >
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <User size={36} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Camera size={20} />
                </div>
              </div>
              <input
                type="file"
                ref={avatarFileRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarSelect}
              />
              <p className="text-[10px] text-slate-400 mt-2 font-medium">Tap photo to change avatar</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                />
              </div>

              <button
                onClick={save}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
              >
                Save Profile
              </button>

              <button
                onClick={onLogout}
                className="w-full py-2.5 bg-slate-950 border border-rose-500/40 hover:bg-rose-500/10 text-rose-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Logout / Switch Account</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ==========================================
// 8. LOGIN & PERMANENT PIN REGISTRATION MODAL
// ==========================================
function AuthSecurityModal({
  isOpen,
  onAuthSuccess,
}: {
  isOpen: boolean;
  onAuthSuccess: (userObj: { phone: string; seqId: string; name: string; avatar: string }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (pin.length !== 4) {
      setError("Security PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);

    try {
      const accountRef = doc(db, "phone_accounts", cleanPhone);
      const accountSnap = await getDoc(accountRef);

      if (accountSnap.exists()) {
        const data = accountSnap.data();
        if (data.pin !== pin) {
          setError("Incorrect PIN. Please enter your secret 4-digit PIN.");
          setLoading(false);
          return;
        }

        onAuthSuccess({
          phone: cleanPhone,
          seqId: data.seqId,
          name: data.name || `User-${data.seqId.slice(-4)}`,
          avatar: data.avatar || "",
        });
      } else {
        if (!isRegistering) {
          setIsRegistering(true);
          setLoading(false);
          return;
        }

        const counterRef = doc(db, "metadata", "id_counter");
        const assignedNum = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let nextVal = 1;
          if (counterDoc.exists()) {
            nextVal = (counterDoc.data().current || 0) + 1;
          }
          transaction.set(counterRef, { current: nextVal }, { merge: true });
          return nextVal;
        });

        const permanentSeqId = String(assignedNum).padStart(10, "0");
        const userName = name.trim() || `User-${permanentSeqId.slice(-4)}`;

        await setDoc(accountRef, {
          phone: cleanPhone,
          pin,
          seqId: permanentSeqId,
          name: userName,
          avatar: "",
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "users", permanentSeqId), {
          phone: cleanPhone,
          name: userName,
          online: true,
          lastSeen: serverTimestamp(),
        });

        onAuthSuccess({
          phone: cleanPhone,
          seqId: permanentSeqId,
          name: userName,
          avatar: "",
        });
      }
    } catch (err: any) {
      setError("Network or Firebase authorization error. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(56,189,248,0.25)] relative"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-rose-500/30 mb-4">
          <Lock size={26} />
        </div>

        <h2 className="text-xl font-black text-center text-white">
          {isRegistering ? "Permanent ID Registration" : "Login to Lets Chat"}
        </h2>
        <p className="text-xs text-slate-400 text-center mt-1 mb-5">
          {isRegistering
            ? "Your 10-digit ID will be permanently locked to this mobile number."
            : "Enter your mobile number and permanent 4-digit PIN."}
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Mobile Number
            </label>
            <div className="relative">
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit Mobile Number"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500 font-mono tracking-wider"
                required
              />
              <Smartphone size={15} className="absolute left-3 top-3 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Secret 4-Digit PIN
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500 font-mono tracking-widest text-center text-base"
                required
              />
              <KeyRound size={15} className="absolute left-3 top-3 text-slate-500" />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thalapathy Fan / Koushik"
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-rose-600 via-sky-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs shadow-lg shadow-sky-600/30 transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? "Verifying..." : isRegistering ? "Claim My Permanent ID" : "Unlock My Account"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ==========================================
// 9. REASSEMBLE CHUNKED VIDEO MEDIA COMPONENT
// ==========================================
function ChunkedVideoPlayer({ mediaId, mimeType }: { mediaId: string; mimeType: string }) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchChunks = async () => {
      try {
        const qChunks = query(collection(db, "media_chunks", mediaId, "chunks"), orderBy("index", "asc"));
        const snap = await getDocs(qChunks);

        const base64Parts = snap.docs.map((docSnap) => docSnap.data().data);
        const fullBase64 = base64Parts.join("");

        if (isMounted) {
          setVideoSrc(fullBase64);
          setLoading(false);
        }
      } catch (err) {
        console.error("Chunk load error:", err);
        setLoading(false);
      }
    };

    fetchChunks();
    return () => {
      isMounted = false;
    };
  }, [mediaId]);

  if (loading) {
    return (
      <div className="w-56 h-36 rounded-xl bg-slate-950 flex flex-col items-center justify-center p-3 border border-slate-800 text-center">
        <span className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-[10px] text-sky-400 font-mono font-bold">Streaming Media...</p>
      </div>
    );
  }

  return (
    <div className="w-56 rounded-xl overflow-hidden bg-black border border-slate-800">
      <video src={videoSrc || ""} controls className="w-full max-h-72 rounded-xl" preload="metadata" />
    </div>
  );
}

// ==========================================
// 10. MASTER CHAT WORKSPACE
// ==========================================
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  type: "text" | "meme" | "image" | "video" | "chunked_video" | "audio";
  mediaId?: string;
  mimeType?: string;
  memeMeta?: { quote: string; actor: string; movie: string };
  reactions?: Record<string, string>;
  createdAt?: any;
}

interface ChatRequest {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted" | "declined";
  createdAt?: any;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [showMemes, setShowMemes] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myFancyNumber, setMyFancyNumber] = useState("");
  const [myName, setMyName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [targetId, setTargetId] = useState("");
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; isGlobal: boolean; isAccepted?: boolean }>({
    id: "global",
    name: "Global Lounge",
    isGlobal: true,
    isAccepted: true,
  });
  const [recentChats, setRecentChats] = useState<string[]>([]);
  const [callActive, setCallActive] = useState(false);
  const [callIsVideo, setCallIsVideo] = useState(true);
  const [heartTrigger, setHeartTrigger] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Notification Permission State
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Incoming Requests & Push Notification Toast
  const [incomingRequests, setIncomingRequests] = useState<ChatRequest[]>([]);
  const [activeToast, setActiveToast] = useState<{ sender: string; text: string; roomId: string } | null>(null);

  // Audio Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const {
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoEnabled,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useInlineAgora();

  // Check & Setup Mobile Push Notification Permissions
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationGranted(true);
      } else if (Notification.permission === "default") {
        setShowNotifPrompt(true);
      }
    }
  }, []);

  const requestNotificationAccess = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotificationGranted(true);
        setShowNotifPrompt(false);
        triggerMobileSystemNotification("Notifications Enabled! 🔔", "You will now receive alerts even when outside Lets Chat.");
      } else {
        setShowNotifPrompt(false);
      }
    }
  };

  // Authentication & Permanent Session Validation
  useEffect(() => {
    const savedPhone = localStorage.getItem("lovechat_perm_phone");
    const savedId = localStorage.getItem("lovechat_perm_id");
    const savedName = localStorage.getItem("lovechat_perm_name") || "";
    const savedAvatar = localStorage.getItem("lovechat_perm_avatar") || "";

    if (savedPhone && savedId) {
      setMyPhone(savedPhone);
      setMyFancyNumber(savedId);
      setMyName(savedName || `User-${savedId.slice(-4)}`);
      setMyAvatar(savedAvatar);
      setIsAuthModalOpen(false);
      setDoc(doc(db, "users", savedId), { lastSeen: serverTimestamp(), online: true }, { merge: true });
    } else {
      setIsAuthModalOpen(true);
    }

    const recents = JSON.parse(localStorage.getItem("lovechat_recents") || "[]");
    setRecentChats(recents);
  }, []);

  const handleAuthSuccess = (userObj: { phone: string; seqId: string; name: string; avatar: string }) => {
    localStorage.setItem("lovechat_perm_phone", userObj.phone);
    localStorage.setItem("lovechat_perm_id", userObj.seqId);
    localStorage.setItem("lovechat_perm_name", userObj.name);
    localStorage.setItem("lovechat_perm_avatar", userObj.avatar);

    setMyPhone(userObj.phone);
    setMyFancyNumber(userObj.seqId);
    setMyName(userObj.name);
    setMyAvatar(userObj.avatar);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("lovechat_perm_phone");
    localStorage.removeItem("lovechat_perm_id");
    localStorage.removeItem("lovechat_perm_name");
    localStorage.removeItem("lovechat_perm_avatar");
    setIsProfileOpen(false);
    setIsAuthModalOpen(true);
  };

  // Listen for Incoming Requests
  useEffect(() => {
    if (!myFancyNumber) return;

    const qReq = query(collection(db, "chat_requests"), where("to", "==", myFancyNumber), where("status", "==", "pending"));
    const unsubReq = onSnapshot(qReq, (snap) => {
      const reqs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatRequest, "id">) }));
      if (reqs.length > incomingRequests.length) {
        triggerMobileSystemNotification("New Chat Request! 💌", `${reqs[0]?.from} wants to connect with you.`);
      }
      setIncomingRequests(reqs);
    });

    return () => unsubReq();
  }, [myFancyNumber, incomingRequests.length]);

  // Listen for Messages in Active Room
  useEffect(() => {
    if (!myFancyNumber) return;

    const messagesRef = activeChat.isGlobal
      ? collection(db, "global_messages")
      : collection(db, "private_chats", activeChat.id, "messages");

    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Message, "id">),
      }));
      setMessages(fetched);

      const lastMsg = fetched[fetched.length - 1];
      if (lastMsg && lastMsg.senderId !== myFancyNumber) {
        const previewText =
          lastMsg.type === "meme"
            ? "Sent a Tamil Meme"
            : lastMsg.type === "video" || lastMsg.type === "chunked_video"
            ? "Sent a Video"
            : lastMsg.type === "audio"
            ? "Sent a Voice Note"
            : lastMsg.text;

        // Trigger Mobile Background System Notification if tab is inactive/hidden
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          triggerMobileSystemNotification(`${lastMsg.senderName || lastMsg.senderId}`, previewText, lastMsg.senderAvatar);
        } else {
          playNotificationChime();
        }

        setActiveToast({
          sender: lastMsg.senderName || lastMsg.senderId,
          text: previewText,
          roomId: activeChat.id,
        });

        if (lastMsg.text.includes("❤️")) {
          setHeartTrigger((prev) => prev + 1);
        }
      }

      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [activeChat, myFancyNumber]);

  // Update Profile
  const handleUpdateProfile = (newName: string, newAvatar: string) => {
    setMyName(newName);
    setMyAvatar(newAvatar);
    localStorage.setItem("lovechat_perm_name", newName);
    localStorage.setItem("lovechat_perm_avatar", newAvatar);

    if (myFancyNumber) {
      setDoc(doc(db, "users", myFancyNumber), { name: newName, avatar: newAvatar }, { merge: true });
    }
    if (myPhone) {
      setDoc(doc(db, "phone_accounts", myPhone), { name: newName, avatar: newAvatar }, { merge: true });
    }
  };

  // Connection Request Management
  const sendConnectionRequest = async (partnerId: string) => {
    if (!partnerId || partnerId === myFancyNumber) return;

    try {
      await addDoc(collection(db, "chat_requests"), {
        from: myFancyNumber,
        to: partnerId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert(`Chat request sent to ${partnerId}! When they accept, your conversation will open.`);
      setTargetId("");
    } catch (err) {
      console.error(err);
    }
  };

  const acceptConnectionRequest = async (req: ChatRequest) => {
    try {
      await updateDoc(doc(db, "chat_requests", req.id), { status: "accepted" });

      const roomId = [myFancyNumber, req.from].sort().join("_");
      setActiveChat({ id: roomId, name: req.from, isGlobal: false, isAccepted: true });

      if (!recentChats.includes(req.from)) {
        const updated = [req.from, ...recentChats];
        setRecentChats(updated);
        localStorage.setItem("lovechat_recents", JSON.stringify(updated));
      }

      setIncomingRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error(err);
    }
  };

  const declineConnectionRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, "chat_requests", reqId), { status: "declined" });
      setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (err) {
      console.error(err);
    }
  };

  const selectPrivateChat = (partnerId: string) => {
    if (!partnerId || partnerId === myFancyNumber) return;
    const roomId = [myFancyNumber, partnerId].sort().join("_");
    setActiveChat({ id: roomId, name: partnerId, isGlobal: false, isAccepted: true });
    setTargetId("");
    setIsDrawerOpen(false);

    if (!recentChats.includes(partnerId)) {
      const updated = [partnerId, ...recentChats];
      setRecentChats(updated);
      localStorage.setItem("lovechat_recents", JSON.stringify(updated));
    }
  };

  const sendMessage = async (
    text: string,
    type: "text" | "meme" | "image" | "video" | "chunked_video" | "audio" = "text",
    memeMeta?: { quote: string; actor: string; movie: string },
    extraPayload?: Record<string, any>
  ) => {
    if (!text.trim() && type === "text") return;

    const messagesRef = activeChat.isGlobal
      ? collection(db, "global_messages")
      : collection(db, "private_chats", activeChat.id, "messages");

    try {
      await addDoc(messagesRef, {
        text,
        senderId: myFancyNumber,
        senderName: myName || myFancyNumber,
        senderAvatar: myAvatar || "",
        createdAt: serverTimestamp(),
        type,
        ...(memeMeta ? { memeMeta } : {}),
        ...(extraPayload ? extraPayload : {}),
      });
      setMessage("");
    } catch (e) {
      console.error("Message send failure:", e);
    }
  };

  // Add Emoji Reaction to Any Message
  const addReactionToMessage = async (msgId: string, emoji: string) => {
    const messageDocRef = activeChat.isGlobal
      ? doc(db, "global_messages", msgId)
      : doc(db, "private_chats", activeChat.id, "messages", msgId);

    try {
      await updateDoc(messageDocRef, {
        [`reactions.${myFancyNumber}`]: emoji,
      });
    } catch (e) {
      console.error("Reaction update:", e);
    }
  };

  // =========================================================================
  // HIGH-PERFORMANCE VIDEO & LARGE MEDIA ENGINE (CHUNKING UP TO 50MB)
  // =========================================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    const isAudio = file.type.startsWith("audio");

    const reader = new FileReader();

    if (isVideo && file.size > 800 * 1024) {
      // Chunked delivery for videos larger than 800KB
      setUploadProgress(10);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const mediaId = `vid_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
        const CHUNK_SIZE = 700 * 1024; // 700KB per slice (Safe for Firestore 1MB ceiling)
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          const slice = base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await addDoc(collection(db, "media_chunks", mediaId, "chunks"), {
            index: i,
            data: slice,
          });
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        // Post master message pointing to chunk id
        await sendMessage("[Video Media]", "chunked_video", undefined, {
          mediaId,
          mimeType: file.type || "video/mp4",
        });

        setUploadProgress(null);
      };
      reader.readAsDataURL(file);
    } else {
      // Direct stream for photos & small clips
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const fileType = isVideo ? "video" : isAudio ? "audio" : "image";
        await sendMessage(base64Data, fileType);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        audioInputRef.current?.click();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendMessage(base64Audio, "audio");
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSec(0);
      recordTimerRef.current = setInterval(() => setRecordSec((prev) => prev + 1), 1000);
    } catch (err) {
      audioInputRef.current?.click();
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } else {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const copyMyId = () => {
    navigator.clipboard.writeText(myFancyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerLoveBurst = () => {
    setHeartTrigger((prev) => prev + 1);
    sendMessage("❤️❤️❤️ LOVE SHOWER ❤️❤️❤️", "text");
  };

  const initiateCall = async (video: boolean) => {
    setCallIsVideo(video);
    setCallActive(true);
    await startCall(activeChat.id, video);
  };

  const terminateCall = async () => {
    await endCall();
    setCallActive(false);
  };

  return (
    <div className="flex h-screen w-full bg-black text-slate-100 overflow-hidden font-sans select-none relative">
      <InlineHeartShower trigger={heartTrigger} />

      {/* Mobile Push Notification Permission Prompt Banner */}
      <AnimatePresence>
        {showNotifPrompt && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-3 inset-x-3 sm:max-w-md sm:mx-auto z-50 bg-gradient-to-r from-slate-900 to-sky-950 border border-sky-500/70 p-3.5 rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.4)] backdrop-blur-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/40">
                <BellRing size={16} className="animate-bounce" />
              </div>
              <div>
                <p className="text-xs font-black text-white">Enable Mobile Alerts?</p>
                <p className="text-[10px] text-slate-300">Get alerts even when app is closed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNotifPrompt(false)}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-1"
              >
                Later
              </button>
              <button
                onClick={requestNotificationAccess}
                className="text-[11px] font-bold bg-sky-500 hover:bg-sky-400 text-black px-3 py-1.5 rounded-xl shadow-md"
              >
                Allow
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating In-App Cyber Notification Card */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            onClick={() => setActiveToast(null)}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-sky-500/60 shadow-[0_0_25px_rgba(56,189,248,0.4)] backdrop-blur-xl px-4 py-2.5 rounded-2xl flex items-center gap-3 cursor-pointer max-w-sm w-[90%]"
          >
            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
              <Bell size={14} className="animate-bounce" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-black text-white truncate">{activeToast.sender}</p>
              <p className="text-[11px] text-sky-300 truncate">{activeToast.text}</p>
            </div>
            <span className="text-[10px] bg-sky-500/20 text-sky-400 font-bold px-2 py-0.5 rounded-md border border-sky-500/40">
              Open
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyber Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rose-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Navigation Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-slate-950/95 backdrop-blur-2xl border-r border-sky-950/40 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isDrawerOpen ? "translate-x-0 shadow-[0_0_50px_rgba(56,189,248,0.2)]" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-slate-900 bg-black/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                onClick={() => setIsProfileOpen(true)}
                className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] cursor-pointer overflow-hidden border border-rose-400/40"
              >
                {myAvatar ? (
                  <img src={myAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Heart size={18} className="fill-white" />
                )}
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-rose-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                  {myName || "Lets Chat"}
                </h1>
                <p className="text-[10px] text-sky-400 font-bold tracking-widest uppercase">
                  Cyber Love Matrix
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Edit Profile"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white md:hidden"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Sequential 10-Digit ID Card */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/90 border border-sky-500/30 shadow-inner">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Permanent ID</p>
              <p className="text-sm font-mono font-black text-rose-400 tracking-widest">
                {myFancyNumber || "0000000001"}
              </p>
            </div>
            <button
              onClick={copyMyId}
              className="flex items-center gap-1 text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2.5 py-1.5 rounded-xl hover:bg-sky-500 hover:text-white transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Request / Search ID Input */}
          <div className="mt-3 relative">
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendConnectionRequest(targetId.trim())}
              placeholder="Search ID (e.g. 0000000002)..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500 transition-all font-mono"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            {targetId && (
              <button
                onClick={() => sendConnectionRequest(targetId.trim())}
                className="absolute right-2 top-1.5 p-1 rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                title="Send Chat Request"
              >
                <UserPlus size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Incoming Connection Requests Banner */}
        {incomingRequests.length > 0 && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30">
            <div className="flex items-center gap-1.5 mb-2 text-rose-400 font-bold text-xs">
              <Bell size={14} className="animate-bounce" />
              <span>Incoming Connection Requests</span>
            </div>
            {incomingRequests.map((req) => (
              <div key={req.id} className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/40 flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-mono font-bold text-white">{req.from}</p>
                  <p className="text-[10px] text-slate-400">Wants to chat with you!</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => acceptConnectionRequest(req)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold shadow-md shadow-rose-600/30"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineConnectionRequest(req.id)}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-[10px] hover:text-white"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div
            onClick={() => {
              setActiveChat({ id: "global", name: "Global Lounge", isGlobal: true, isAccepted: true });
              setIsDrawerOpen(false);
            }}
            className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
              activeChat.isGlobal
                ? "bg-gradient-to-r from-rose-500/20 via-sky-500/20 to-indigo-500/20 border border-sky-500/50 text-sky-300 font-bold shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                : "text-slate-300 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Globe size={16} className={activeChat.isGlobal ? "text-sky-400" : "text-slate-400"} />
              <span className="text-xs">Global Lounge</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="pt-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">
              Connected Friends & Lovers
            </p>
            {recentChats.length === 0 ? (
              <div className="p-4 text-center rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                No connections yet. Request a partner using their 10-digit ID!
              </div>
            ) : (
              recentChats.map((id) => (
                <div
                  key={id}
                  onClick={() => selectPrivateChat(id)}
                  className={`p-2.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                    activeChat.name === id
                      ? "bg-slate-900 border border-rose-500/50 text-rose-300 font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                      : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck size={14} className="text-sky-400" />
                    <span className="text-xs font-mono font-semibold">{id}</span>
                  </div>
                  <ShieldCheck size={14} className="text-emerald-400" />
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Canvas */}
      <main className="flex-1 flex flex-col relative bg-black/90">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white md:hidden"
            >
              <Menu size={22} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-sky-500 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              {activeChat.isGlobal ? <Globe size={18} /> : <MessageCircle size={18} />}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 leading-tight">{activeChat.name}</h2>
              <p className="text-[10px] text-sky-400 font-bold flex items-center gap-1 mt-0.5">
                <Radio size={10} className="animate-pulse" />
                Cyber Matrix Connected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => initiateCall(false)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 text-slate-300 hover:text-sky-400 transition-all active:scale-95"
              title="Voice Call"
            >
              <Phone size={17} />
            </button>
            <button
              onClick={() => initiateCall(true)}
              className="p-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-sky-600 text-white font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] active:scale-95"
              title="Video Call"
            >
              <Video size={17} />
            </button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5">
          {messages.map((msg) => {
            const isMe = msg.senderId === myFancyNumber;
            const timeFormatted = msg.createdAt?.toDate
              ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "...";

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                <div
                  className={`relative p-3 rounded-2xl max-w-[85%] sm:max-w-[60%] shadow-lg ${
                    isMe
                      ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-tr-none shadow-rose-600/30"
                      : "bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none shadow-sky-950/40"
                  }`}
                >
                  {/* Floating Micro-Reaction Drawer on Hover/Tap */}
                  <div
                    className={`absolute -top-3 ${
                      isMe ? "right-2" : "left-2"
                    } opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-sky-500/40 rounded-full px-2 py-0.5 flex items-center gap-1 shadow-lg z-20`}
                  >
                    {["❤️", "🔥", "😂", "😍", "👍"].map((emoji) => (
                      <span
                        key={emoji}
                        onClick={() => addReactionToMessage(msg.id, emoji)}
                        className="cursor-pointer hover:scale-125 transition-transform text-xs"
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    {msg.senderAvatar ? (
                      <img src={msg.senderAvatar} alt="Avatar" className="w-4 h-4 rounded-full object-cover" />
                    ) : null}
                    <p
                      className={`text-[10px] font-mono font-black opacity-85 ${
                        isMe ? "text-rose-100" : "text-sky-400"
                      }`}
                    >
                      {msg.senderName || msg.senderId}
                    </p>
                  </div>

                  {msg.type === "meme" && (
                    <div className="rounded-xl overflow-hidden bg-black/80 p-2 space-y-1.5 border border-slate-800 w-44 sm:w-56">
                      <img
                        src={msg.text}
                        alt="Tamil Actor"
                        className="w-full aspect-video rounded-lg object-cover shadow-inner"
                      />
                      {msg.memeMeta && (
                        <div className="text-center pt-0.5">
                          <p className="text-xs font-black italic text-slate-100 leading-snug">
                            "{msg.memeMeta.quote}"
                          </p>
                          <p className="text-[10px] text-sky-400 font-bold mt-0.5">
                            {msg.memeMeta.actor} • {msg.memeMeta.movie}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.type === "image" && (
                    <img src={msg.text} alt="Uploaded attachment" className="w-56 rounded-xl object-cover" />
                  )}

                  {/* Standard Video (<800KB) */}
                  {msg.type === "video" && (
                    <div className="w-56 rounded-xl overflow-hidden bg-black">
                      <video src={msg.text} controls className="w-full max-h-72 rounded-xl" preload="metadata" />
                    </div>
                  )}

                  {/* Chunked Streaming Video (>800KB - 50MB) */}
                  {msg.type === "chunked_video" && msg.mediaId && (
                    <ChunkedVideoPlayer mediaId={msg.mediaId} mimeType={msg.mimeType || "video/mp4"} />
                  )}

                  {msg.type === "audio" && (
                    <div className="flex items-center gap-2 w-52 sm:w-60 py-1">
                      <Volume2 size={18} className="text-sky-400 flex-shrink-0" />
                      <audio src={msg.text} controls className="w-full h-8" />
                    </div>
                  )}

                  {msg.type === "text" && (
                    <p className="text-sm font-medium leading-relaxed break-words">{msg.text}</p>
                  )}

                  {/* Render Message Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(msg.reactions).map(([uid, emo]) => (
                        <span
                          key={uid}
                          className="text-[10px] bg-slate-950/80 px-1.5 py-0.5 rounded-full border border-sky-500/30 font-mono"
                        >
                          {emo}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1">
                    <p
                      className={`text-[9px] opacity-60 font-mono font-semibold ${
                        isMe ? "text-rose-200" : "text-slate-400"
                      }`}
                    >
                      {timeFormatted}
                    </p>
                    {isMe && <CheckCheck size={12} className="text-rose-200 opacity-80" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Real-Time Uploading Progress Indicator */}
        {uploadProgress !== null && (
          <div className="mx-4 mb-2 p-3 rounded-2xl bg-slate-900 border border-sky-500/40 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono font-bold text-sky-300">
                Streaming Video Payload... {uploadProgress}%
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Do not close app</span>
          </div>
        )}

        {/* Live Audio Recording Bar */}
        {isRecording && (
          <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-sky-600 text-white flex items-center justify-between shadow-xl animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white animate-ping" />
              <span className="text-xs font-bold font-mono">Recording Live Audio... {recordSec}s</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stopRecording(true)}
                className="text-xs bg-black/30 hover:bg-black/40 px-2.5 py-1 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => stopRecording(false)}
                className="text-xs bg-white text-rose-600 px-3 py-1 rounded-xl font-black shadow-md"
              >
                Send Voice
              </button>
            </div>
          </div>
        )}

        {/* Composer Bar */}
        <div className="p-2.5 sm:p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900 relative pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex items-end gap-1.5 sm:gap-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-1.5 sm:p-2 focus-within:border-sky-500 transition-colors shadow-inner">
            <button
              onClick={() => setShowMemes(true)}
              className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-400 rounded-2xl transition-colors"
              title="Tamil Actor Reactions"
            >
              <Smile size={22} />
            </button>

            <textarea
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(message);
                }
              }}
              placeholder={`Message ${activeChat.name}...`}
              className="flex-1 py-2 px-1 outline-none text-sm bg-transparent resize-none max-h-32 text-slate-100 placeholder-slate-500 font-medium"
            />

            <div className="flex items-center gap-0.5">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileUpload}
              />
              <input
                type="file"
                ref={audioInputRef}
                className="hidden"
                accept="audio/*"
                onChange={handleFileUpload}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 sm:p-2.5 text-slate-400 hover:text-sky-400 rounded-2xl transition-colors"
                title="Attach Photo or Video"
              >
                <Paperclip size={20} />
              </button>

              <button
                onClick={isRecording ? () => stopRecording(false) : startRecording}
                className={`p-2 sm:p-2.5 rounded-2xl transition-all ${
                  isRecording ? "bg-rose-600 text-white animate-bounce shadow-lg shadow-rose-600/50" : "text-slate-400 hover:text-sky-400"
                }`}
                title="Hold or Tap to Record Audio"
              >
                <Mic size={20} />
              </button>
            </div>

            <button
              onClick={() => sendMessage(message)}
              className="p-2.5 sm:p-3 bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-rose-500/40 transition-transform active:scale-95 flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Security Auth & Login Modal */}
      <AuthSecurityModal
        isOpen={isAuthModalOpen}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Profile Editor Sheet */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        myFancyNumber={myFancyNumber}
        myAvatar={myAvatar}
        myName={myName}
        myPhone={myPhone}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

      {/* Mobile Bottom Sheet for Tamil Stickers */}
      <MobileMemeBottomSheet
        isOpen={showMemes}
        onClose={() => setShowMemes(false)}
        onSelect={(item) =>
          sendMessage(item.url, "meme", {
            quote: item.quote,
            actor: item.actor,
            movie: item.movie,
          })
        }
      />

      {/* Fullscreen Video/Audio Call Overlay */}
      {callActive && (
        <InlineCallModal
          channelName={activeChat.id}
          isVideo={callIsVideo}
          onEndCall={terminateCall}
          localVideoTrack={localVideoTrack}
          remoteUsers={remoteUsers}
          isAudioMuted={isAudioMuted}
          isVideoEnabled={isVideoEnabled}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
        />
      )}
    </div>
  );
}
