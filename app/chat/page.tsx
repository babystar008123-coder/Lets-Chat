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
  CheckCheck,
  ArrowLeft,
  Users,
  Trash2,
  Shield,
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
  deleteDoc,
} from "firebase/firestore";

// ==========================================
// 1. NOTIFICATION CHIME & AUDIO ENGINE
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
    console.warn(e);
  }
}

function triggerMobileSystemNotification(title: string, body: string, icon?: string) {
  playNotificationChime();
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: "lets-chat-message",
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
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
// 2. AGORA WEBRTC ENGINE
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
        console.warn(err);
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
      alert("Add NEXT_PUBLIC_AGORA_APP_ID in .env.local to enable calling!");
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
      console.error(e);
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
// 3. CALL HUD MODAL
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
    if (localVideoTrack && localRef.current) localVideoTrack.play(localRef.current);
  }, [localVideoTrack]);

  useEffect(() => {
    const remote = remoteUsers[0];
    if (remote?.videoTrack && remoteRef.current) remote.videoTrack.play(remoteRef.current);
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
              <p className="text-base font-bold text-slate-200">Call: {channelName}</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                {remoteUsers.length > 0 ? "Call Connected" : "Connecting..."}
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
              isAudioMuted ? "bg-rose-600 text-white shadow-lg" : "bg-slate-900 border border-slate-700 text-slate-200"
            }`}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-2xl transition-all ${
                !isVideoEnabled ? "bg-rose-600 text-white shadow-lg" : "bg-slate-900 border border-slate-700 text-slate-200"
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
// 4. UNLIMITED TAMIL & ENGLISH STICKERS VAULT
// ==========================================
interface StickerItem {
  id: string;
  url: string;
  title: string;
  category: "tamil_comedy" | "tamil_mass" | "english_memes" | "love";
}

const EXTENDED_STICKERS: StickerItem[] = [
  // Tamil Comedy
  {
    id: "t_vadi_1",
    url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyZGNkcGpic3ZuczRkaWxneWF1MmVheWFuZGJiN2RkeTZ4ZnFudm11YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YSdvQxlheVHxQw5hEa/200.gif",
    title: "Vadivelu Laugh",
    category: "tamil_comedy",
  },
  {
    id: "t_vadi_2",
    url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNnEzanNlZHJibTYwYjZzazd3NG55OW5zY3g3cmhkeHM4NnVybXU4MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ESYT0mj1mUyrjr5kDW/200_d.gif",
    title: "Vadivelu Shock",
    category: "tamil_comedy",
  },
  {
    id: "t_gounda_1",
    url: "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyd2I5Mjk3OTl4eHA1Z3hpbjBsejRyMHdoYXkzYXNucTk5aTNpODk3MCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YuWeSpstyR92U5cP0y/200w.gif",
    title: "Goundamani Counter",
    category: "tamil_comedy",
  },
  {
    id: "t_santha_1",
    url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
    title: "Santhanam Sarcasm",
    category: "tamil_comedy",
  },
  // Tamil Mass
  {
    id: "t_mass_1",
    url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUycWc4eW8wMGt5ZWN3dnZ1MWFvZHBsNW92cnNkN3cybnN6aXh3emxucyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3S7dHcfGYlxvqjtHqn/200w.gif",
    title: "Rajini Baasha",
    category: "tamil_mass",
  },
  {
    id: "t_mass_2",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    title: "Ajith Mankatha",
    category: "tamil_mass",
  },
  {
    id: "t_mass_3",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    title: "Kamal Vikram",
    category: "tamil_mass",
  },
  // English Memes
  {
    id: "e_cat_1",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZhcXpnNDhhM2p5Z2g4NGgxcXN5Y3JtNWd2eG9mN3Z0eXVhOTM1eSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif",
    title: "Cat Vibing",
    category: "english_memes",
  },
  {
    id: "e_doge_1",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ29va3I3eGZjc3B0Mnl5N25vaHhyY3k2MWVxdWwxcjR6YWw2MXB2dyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/9C1nyePmmDlS552Emu/giphy.gif",
    title: "Doge Wow",
    category: "english_memes",
  },
  {
    id: "e_pepe_1",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHIxb3p1a2gxdnI2Z2JldDN5aXcxZWt0dzNreTVzZHA2NmN2c3l1eiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/13CoXDiaCcCoyk/giphy.gif",
    title: "Classic Pepe",
    category: "english_memes",
  },
  {
    id: "e_pop_1",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Q0bWk2dmk5N2pmeWp1cTZxcHRnd2Q4ZjhpZHVxdmdwbWVtc2ptYiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/osAcIGJnJ0sjpp3Qg8/giphy.gif",
    title: "Popcat",
    category: "english_memes",
  },
  // Love & Romance
  {
    id: "l_heart_1",
    url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyaXE3MGk2dDAybnpmaHpheGI0a3Ezdzlpb3cwd2diYTVvNTl1OWJrcSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/ddxgdaMGp1GVZTOHS6/giphy.gif",
    title: "Tamizh Love",
    category: "love",
  },
  {
    id: "l_romance_2",
    url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
    title: "Suriya Jessie Love",
    category: "love",
  },
  {
    id: "l_sparkle_3",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    title: "Sweet Romance",
    category: "love",
  },
];

function UnlimitedStickerSheet({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: StickerItem) => void;
}) {
  const [tab, setTab] = useState<"tamil_comedy" | "tamil_mass" | "english_memes" | "love">("tamil_comedy");
  const [search, setSearch] = useState("");

  const filtered = EXTENDED_STICKERS.filter(
    (s) =>
      s.category === tab &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase()))
  );

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
            className="fixed bottom-0 inset-x-0 max-h-[80vh] bg-slate-950 border-t border-sky-500/30 rounded-t-[32px] shadow-2xl z-50 flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-3" />

            {/* Header Tabs & Search */}
            <div className="px-4 pb-3 border-b border-slate-900 space-y-2">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-2xl border border-slate-800 flex-1 mr-2">
                  {(
                    [
                      { key: "tamil_comedy", label: "😂 Tamil" },
                      { key: "tamil_mass", label: "🔥 Mass" },
                      { key: "english_memes", label: "🌐 English" },
                      { key: "love", label: "❤️ Love" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all truncate ${
                        tab === t.key
                          ? "bg-gradient-to-r from-rose-500 to-sky-500 text-white shadow-md"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button onClick={onClose} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stickers (Vadivelu, Cat, Love, etc)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
              </div>
            </div>

            {/* Sticker Grid */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[60vh]">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="cursor-pointer group flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/60 transition-all shadow-sm active:scale-95"
                >
                  <div className="w-full aspect-square flex items-center justify-center overflow-hidden mb-1">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="text-[11px] font-bold text-slate-200 truncate">{item.title}</p>
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
// 5. PROFILE & DELETE ACCOUNT MODAL
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
  onDeleteAccount,
}: {
  isOpen: boolean;
  onClose: () => void;
  myFancyNumber: string;
  myAvatar: string;
  myName: string;
  myPhone: string;
  onUpdateProfile: (name: string, avatar: string) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
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
    reader.onload = () => setAvatar(reader.result as string);
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

            <h3 className="text-lg font-black text-white text-center mb-1">Your Confidential Profile</h3>
            <p className="text-xs text-sky-400 font-mono text-center mb-1 font-bold">Fixed ID: {myFancyNumber}</p>
            <p className="text-[11px] text-slate-400 font-mono text-center mb-4">Phone: +91 {myPhone}</p>

            <div className="flex flex-col items-center mb-5">
              <div
                onClick={() => avatarFileRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-rose-500 shadow-md cursor-pointer group bg-black"
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

            <div className="space-y-3">
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
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 text-white font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95"
              >
                Save Profile
              </button>

              <button
                onClick={onLogout}
                className="w-full py-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Logout Session</span>
              </button>

              <button
                onClick={onDeleteAccount}
                className="w-full py-2 bg-red-950/30 border border-red-600/50 hover:bg-red-900/40 text-red-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Delete Account Permanently</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ==========================================
// 6. LOGIN & REGISTRATION MODAL
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
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).");
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
          avatar: "",
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
      setError("Network or Firebase error. Please try again.");
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
        className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-6 shadow-2xl relative"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-lg mb-4">
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
                placeholder="Enter your name..."
                className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-rose-600 via-sky-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? "Verifying..." : isRegistering ? "Claim My Permanent ID" : "Unlock My Account"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ==========================================
// 7. CHUNKED VIDEO PLAYER FOR STREAMING
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
        console.error(err);
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
        <p className="text-[10px] text-sky-400 font-mono font-bold">Streaming Video...</p>
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
// 8. MASTER PRIVATE CHAT WORKSPACE
// ==========================================
interface UserItem {
  id: string;
  name: string;
  avatar: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  type: "text" | "sticker" | "image" | "video" | "chunked_video" | "audio";
  mediaId?: string;
  mimeType?: string;
  read?: boolean;
  createdAt?: any;
}

interface PendingRequest {
  id: string;
  from: string;
  fromName?: string;
  fromAvatar?: string;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [myFancyNumber, setMyFancyNumber] = useState("");
  const [myName, setMyName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [myPhone, setMyPhone] = useState("");

  // Target ID to Request
  const [targetSearchId, setTargetSearchId] = useState("");

  // Confidential Contacts List (Only mutual accepted friends)
  const [acceptedFriends, setAcceptedFriends] = useState<UserItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Selected private chat partner
  const [activePartner, setActivePartner] = useState<UserItem | null>(null);

  const [callActive, setCallActive] = useState(false);
  const [callIsVideo, setCallIsVideo] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showStickers, setShowStickers] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeToast, setActiveToast] = useState<{ sender: string; text: string; userObj: UserItem } | null>(null);

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

  // Authentication check
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
  }, []);

  // CONFIDENTIAL REAL-TIME CONTACTS & REQUEST SYNC
  useEffect(() => {
    if (!myFancyNumber) return;

    // 1. Pending Friend Requests sent TO me
    const qPending = query(
      collection(db, "chat_requests"),
      where("to", "==", myFancyNumber),
      where("status", "==", "pending")
    );
    const unsubPending = onSnapshot(qPending, async (snap) => {
      const list: PendingRequest[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        let name = data.fromName || `User-${data.from.slice(-4)}`;
        let avatar = data.fromAvatar || "";
        try {
          const userSnap = await getDoc(doc(db, "users", data.from));
          if (userSnap.exists()) {
            name = userSnap.data().name || name;
            avatar = userSnap.data().avatar || avatar;
          }
        } catch (e) {}
        list.push({ id: d.id, from: data.from, fromName: name, fromAvatar: avatar });
      }
      setPendingRequests(list);
    });

    // 2. Mutual accepted friends (I sent and they accepted)
    const qSent = query(
      collection(db, "chat_requests"),
      where("from", "==", myFancyNumber),
      where("status", "==", "accepted")
    );
    const unsubSent = onSnapshot(qSent, async (snap) => {
      const partnerIds = snap.docs.map((d) => d.data().to);
      loadFriendProfiles(partnerIds);
    });

    // 3. Mutual accepted friends (They sent and I accepted)
    const qReceived = query(
      collection(db, "chat_requests"),
      where("to", "==", myFancyNumber),
      where("status", "==", "accepted")
    );
    const unsubReceived = onSnapshot(qReceived, async (snap) => {
      const partnerIds = snap.docs.map((d) => d.data().from);
      loadFriendProfiles(partnerIds);
    });

    const loadFriendProfiles = async (ids: string[]) => {
      if (ids.length === 0) return;
      for (const partnerId of ids) {
        try {
          const userSnap = await getDoc(doc(db, "users", partnerId));
          const userData = userSnap.exists() ? userSnap.data() : {};
          setAcceptedFriends((prev) => {
            const exists = prev.some((p) => p.id === partnerId);
            if (exists) return prev;
            return [
              ...prev,
              {
                id: partnerId,
                name: userData.name || `User-${partnerId.slice(-4)}`,
                avatar: userData.avatar || "",
              },
            ];
          });
        } catch (e) {}
      }
    };

    return () => {
      unsubPending();
      unsubSent();
      unsubReceived();
    };
  }, [myFancyNumber]);

  // Messages listener for selected partner
  useEffect(() => {
    if (!myFancyNumber || !activePartner) {
      setMessages([]);
      return;
    }

    const roomId = [myFancyNumber, activePartner.id].sort().join("_");
    const messagesRef = collection(db, "private_chats", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        if (data.senderId !== myFancyNumber && !data.read) {
          updateDoc(docSnap.ref, { read: true });
        }
        return {
          id: docSnap.id,
          ...(data as Omit<Message, "id">),
        };
      });
      setMessages(fetched);

      const lastMsg = fetched[fetched.length - 1];
      if (lastMsg && lastMsg.senderId !== myFancyNumber) {
        const previewText =
          lastMsg.type === "sticker"
            ? "Sent a Sticker"
            : lastMsg.type === "video" || lastMsg.type === "chunked_video"
            ? "Sent a Video"
            : lastMsg.type === "audio"
            ? "Sent a Voice Note"
            : lastMsg.text;

        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          triggerMobileSystemNotification(`${lastMsg.senderName || lastMsg.senderId}`, previewText, lastMsg.senderAvatar);
        } else {
          playNotificationChime();
        }

        setActiveToast({
          sender: lastMsg.senderName || lastMsg.senderId,
          text: previewText,
          userObj: activePartner,
        });
      }

      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [activePartner, myFancyNumber]);

  // Send confidential friend request by 10-digit ID
  const handleSendFriendRequest = async () => {
    const cleanTarget = targetSearchId.trim().replace(/\D/g, "");
    if (cleanTarget.length !== 10) {
      alert("Please enter a valid 10-digit Fancy ID.");
      return;
    }
    if (cleanTarget === myFancyNumber) {
      alert("You cannot add your own ID.");
      return;
    }

    try {
      const targetUserSnap = await getDoc(doc(db, "users", cleanTarget));
      if (!targetUserSnap.exists()) {
        alert("No user registered with this 10-digit ID. Please check the number.");
        return;
      }

      await addDoc(collection(db, "chat_requests"), {
        from: myFancyNumber,
        fromName: myName,
        fromAvatar: myAvatar,
        to: cleanTarget,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert(`Confidential chat request sent to ID ${cleanTarget}! Once they accept, they will appear in your contacts.`);
      setTargetSearchId("");
    } catch (err) {
      console.error(err);
      alert("Failed to send request.");
    }
  };

  const handleAcceptRequest = async (req: PendingRequest) => {
    try {
      await updateDoc(doc(db, "chat_requests", req.id), { status: "accepted" });

      const newFriend: UserItem = {
        id: req.from,
        name: req.fromName || `User-${req.from.slice(-4)}`,
        avatar: req.fromAvatar || "",
      };

      setAcceptedFriends((prev) => {
        if (prev.some((p) => p.id === req.from)) return prev;
        return [...prev, newFriend];
      });

      setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
      setActivePartner(newFriend);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, "chat_requests", reqId), { status: "declined" });
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (e) {
      console.error(e);
    }
  };

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
    localStorage.clear();
    setIsProfileOpen(false);
    setIsAuthModalOpen(true);
  };

  const handleDeleteChatHistory = async () => {
    if (!activePartner || !myFancyNumber) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete all chat history with ${activePartner.name}? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const roomId = [myFancyNumber, activePartner.id].sort().join("_");
      const messagesRef = collection(db, "private_chats", roomId, "messages");
      const snap = await getDocs(messagesRef);

      const deletePromises = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
      alert("Chat history cleared successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to clear chat history.");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "WARNING: This will permanently delete your user profile and registered ID. Continue?"
    );
    if (!confirmDelete) return;

    try {
      if (myFancyNumber) {
        await deleteDoc(doc(db, "users", myFancyNumber));
      }
      if (myPhone) {
        await deleteDoc(doc(db, "phone_accounts", myPhone));
      }
      localStorage.clear();
      setIsProfileOpen(false);
      setIsAuthModalOpen(true);
      alert("Your account has been deleted permanently.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete account.");
    }
  };

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

  const sendMessage = async (
    text: string,
    type: "text" | "sticker" | "image" | "video" | "chunked_video" | "audio" = "text",
    extraPayload?: Record<string, any>
  ) => {
    if (!text.trim() && type === "text") return;
    if (!activePartner) return;

    const roomId = [myFancyNumber, activePartner.id].sort().join("_");
    const messagesRef = collection(db, "private_chats", roomId, "messages");

    try {
      await addDoc(messagesRef, {
        text,
        senderId: myFancyNumber,
        senderName: myName || myFancyNumber,
        senderAvatar: myAvatar || "",
        createdAt: serverTimestamp(),
        type,
        read: false,
        ...(extraPayload ? extraPayload : {}),
      });
      setMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    const isAudio = file.type.startsWith("audio");

    const reader = new FileReader();

    if (isVideo && file.size > 800 * 1024) {
      setUploadProgress(10);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const mediaId = `vid_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
        const CHUNK_SIZE = 700 * 1024;
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          const slice = base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await addDoc(collection(db, "media_chunks", mediaId, "chunks"), {
            index: i,
            data: slice,
          });
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        await sendMessage("[Video Media]", "chunked_video", {
          mediaId,
          mimeType: file.type || "video/mp4",
        });

        setUploadProgress(null);
      };
      reader.readAsDataURL(file);
    } else {
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

  const initiateCall = async (video: boolean) => {
    if (!activePartner) return;
    const roomId = [myFancyNumber, activePartner.id].sort().join("_");
    setCallIsVideo(video);
    setCallActive(true);
    await startCall(roomId, video);
  };

  const terminateCall = async () => {
    await endCall();
    setCallActive(false);
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-black text-slate-100 font-sans select-none flex flex-row">
      {/* Floating In-App Toast */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            onClick={() => {
              setActivePartner(activeToast.userObj);
              setActiveToast(null);
            }}
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

      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rose-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* CONFIDENTIAL CONTACTS SIDEBAR */}
      <aside
        className={`w-full md:w-80 h-full flex flex-col bg-slate-950 border-r border-slate-900 z-30 transition-all ${
          activePartner ? "hidden md:flex" : "flex"
        }`}
      >
        {/* User Identity Header */}
        <div className="p-4 border-b border-slate-900 bg-black/60 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                onClick={() => setIsProfileOpen(true)}
                className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md cursor-pointer overflow-hidden border border-rose-400/40"
              >
                {myAvatar ? (
                  <img src={myAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-white">{myName || "Lets Chat"}</h1>
                <p className="text-[10px] text-sky-400 font-bold tracking-widest uppercase">My Profile</p>
              </div>
            </div>
            <button
              onClick={() => setIsProfileOpen(true)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Edit Profile"
            >
              <Settings size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/90 border border-sky-500/30 shadow-inner">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Your Confidential ID</p>
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

          {/* Add Partner by 10-Digit ID */}
          <div className="mt-3 flex gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={10}
                value={targetSearchId}
                onChange={(e) => setTargetSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendFriendRequest()}
                placeholder="Enter friend's 10-digit ID..."
                className="w-full pl-8 pr-2 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 outline-none focus:border-sky-500 font-mono"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            </div>
            <button
              onClick={handleSendFriendRequest}
              className="px-3 py-2 bg-gradient-to-r from-rose-600 to-sky-600 hover:from-rose-500 hover:to-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md"
            >
              <UserPlus size={14} />
              <span>Request</span>
            </button>
          </div>
        </div>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Bell size={12} className="animate-bounce" />
              <span>Pending Requests ({pendingRequests.length})</span>
            </p>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/40 flex items-center justify-between">
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{req.fromName}</p>
                    <p className="text-[10px] text-sky-400 font-mono">ID: {req.from}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(req.id)}
                      className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white text-[10px] rounded-lg"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted Contacts Directory (Empty by default until accepted) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck size={14} className="text-sky-400" />
            <span>My Confidential Contacts</span>
          </div>

          {acceptedFriends.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-400 mx-auto mb-2 border border-slate-800">
                <Shield size={22} />
              </div>
              <p className="font-bold text-white mb-1">Your contact list is private & empty</p>
              <p className="text-[11px] text-slate-400">
                Enter your friend's 10-digit ID above to send a private connection request.
              </p>
            </div>
          ) : (
            acceptedFriends.map((f) => {
              const isSelected = activePartner?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setActivePartner(f)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between border ${
                    isSelected
                      ? "bg-slate-900 border-sky-500/60 shadow-md"
                      : "bg-slate-950 hover:bg-slate-900/60 border-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-full overflow-hidden border border-rose-500/40 bg-slate-900 flex items-center justify-center text-sky-400 font-bold">
                      {f.avatar ? (
                        <img src={f.avatar} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        f.name.charAt(0)
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">{f.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {f.id}</p>
                    </div>
                  </div>

                  <span className="text-xs bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded-xl font-bold border border-sky-500/20">
                    Chat
                  </span>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* PRIVATE 1-ON-1 CHAT WORKSPACE */}
      <main
        className={`flex-1 flex flex-col h-full w-full overflow-hidden bg-black relative ${
          !activePartner ? "hidden md:flex items-center justify-center" : "flex"
        }`}
      >
        {!activePartner ? (
          <div className="text-center p-8 text-slate-500 max-w-sm">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-sky-400 mx-auto mb-3 border border-slate-800">
              <MessageCircle size={28} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No conversation selected</h3>
            <p className="text-xs text-slate-400">
              Your chats are end-to-end confidential. Enter a friend's 10-digit ID on the left to connect!
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 bg-slate-950 border-b border-slate-900 z-10 flex-shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  onClick={() => setActivePartner(null)}
                  className="p-1.5 -ml-1 text-slate-300 hover:text-white md:hidden"
                  title="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden border border-sky-400/40 bg-slate-900 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {activePartner.avatar ? (
                    <img src={activePartner.avatar} alt={activePartner.name} className="w-full h-full object-cover" />
                  ) : (
                    activePartner.name.charAt(0)
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-100 leading-tight">{activePartner.name}</h2>
                  <p className="text-[10px] text-sky-400 font-mono mt-0.5">ID: {activePartner.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleDeleteChatHistory}
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 transition-all"
                  title="Clear Chat History"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => initiateCall(false)}
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 text-slate-300 hover:text-sky-400 transition-all active:scale-95"
                  title="Voice Call"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={() => initiateCall(true)}
                  className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-sky-600 text-white font-bold transition-all shadow-md active:scale-95"
                  title="Video Call"
                >
                  <Video size={16} />
                </button>
              </div>
            </header>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <p className="text-sm font-bold text-white mb-1">Say Hi to {activePartner.name}! 👋</p>
                  <p className="text-xs text-slate-400">Confidential direct conversation.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === myFancyNumber;
                  const timeFormatted = msg.createdAt?.toDate
                    ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "...";

                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} w-full`}>
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[60%] shadow-lg ${
                          isMe
                            ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-tr-none shadow-rose-600/30"
                            : "bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none shadow-sky-950/40"
                        }`}
                      >
                        {msg.type === "sticker" && (
                          <div className="w-44 aspect-square flex items-center justify-center p-1 mb-1">
                            <img src={msg.text} alt="Sticker" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}

                        {msg.type === "image" && (
                          <img src={msg.text} alt="Attachment" className="w-56 rounded-xl object-cover mb-1" />
                        )}

                        {msg.type === "video" && (
                          <div className="w-56 rounded-xl overflow-hidden bg-black mb-1">
                            <video src={msg.text} controls className="w-full max-h-72 rounded-xl" preload="metadata" />
                          </div>
                        )}

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

                        <div className="flex items-center justify-end gap-1 mt-1">
                          <p className={`text-[9px] font-mono font-semibold ${isMe ? "text-rose-200" : "text-slate-400"}`}>
                            {timeFormatted}
                          </p>
                          {isMe && (
                            <CheckCheck
                              size={13}
                              className={msg.read ? "text-sky-300" : "text-rose-200 opacity-70"}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>

            {/* Video Upload Indicator */}
            {uploadProgress !== null && (
              <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-slate-900 border border-sky-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono font-bold text-sky-300">Streaming Video... {uploadProgress}%</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Please wait</span>
              </div>
            )}

            {/* Audio Recording Status */}
            {isRecording && (
              <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-sky-600 text-white flex items-center justify-between shadow-xl animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                  <span className="text-xs font-bold font-mono">Recording Audio... {recordSec}s</span>
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

            {/* Message Input Composer */}
            <div className="p-2 sm:p-3 bg-slate-950 border-t border-slate-900 w-full flex-shrink-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="max-w-4xl mx-auto flex items-end gap-1.5 sm:gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 focus-within:border-sky-500 transition-colors">
                <button
                  onClick={() => setShowStickers(true)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-xl transition-colors"
                  title="Stickers & Memes"
                >
                  <Smile size={20} />
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
                  placeholder={`Message ${activePartner.name}...`}
                  className="flex-1 py-1.5 px-2 outline-none text-sm bg-transparent resize-none max-h-28 text-slate-100 placeholder-slate-500 font-medium"
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
                    className="p-2 text-slate-400 hover:text-sky-400 rounded-xl transition-colors"
                    title="Attach Media"
                  >
                    <Paperclip size={18} />
                  </button>

                  <button
                    onClick={isRecording ? () => stopRecording(false) : startRecording}
                    className={`p-2 rounded-xl transition-all ${
                      isRecording ? "bg-rose-600 text-white animate-bounce shadow-lg" : "text-slate-400 hover:text-sky-400"
                    }`}
                    title="Voice Note"
                  >
                    <Mic size={18} />
                  </button>
                </div>

                <button
                  onClick={() => sendMessage(message)}
                  className="p-2.5 bg-gradient-to-tr from-rose-500 via-sky-500 to-indigo-600 text-white rounded-xl shadow-md transition-transform active:scale-95 flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Expanded Tamil & English Sticker Drawer */}
      <UnlimitedStickerSheet
        isOpen={showStickers}
        onClose={() => setShowStickers(false)}
        onSelect={(sticker) => sendMessage(sticker.url, "sticker")}
      />

      {/* Security Auth Modal */}
      <AuthSecurityModal
        isOpen={isAuthModalOpen}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Profile & Delete Account Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        myFancyNumber={myFancyNumber}
        myAvatar={myAvatar}
        myName={myName}
        myPhone={myPhone}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Call HUD Overlay */}
      {callActive && (
        <InlineCallModal
          channelName={activePartner ? [myFancyNumber, activePartner.id].sort().join("_") : "call"}
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