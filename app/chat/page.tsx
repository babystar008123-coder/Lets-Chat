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
  Globe,
  UserCheck,
  Mic,
  MicOff,
  PhoneOff,
  VideoOff,
  ArrowRight,
  Radio,
  Copy,
  Check,
  MessageCircle,
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
  Play,
  Pause,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
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
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

// ==========================================
// 1. NOTIFICATION SOUND & SYSTEM NOTIFICATION
// ==========================================
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
      alert("Please configure NEXT_PUBLIC_AGORA_APP_ID in .env.local to enable calling.");
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
// 3. SECURE PHONE AUTH + OTP VERIFICATION
// ==========================================
function PhoneAuthModal({
  isOpen,
  onAuthSuccess,
}: {
  isOpen: boolean;
  onAuthSuccess: (userObj: { phone: string; seqId: string; name: string; avatar: string }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "pin">("phone");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    if (!(window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      } catch (err) {
        console.warn("Recaptcha error:", err);
      }
    }
  }, [isOpen]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = phone.trim().replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError("Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).");
      return;
    }

    setLoading(true);
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = `+91${clean}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Failed to send verification SMS. Check Firebase configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit code received via SMS.");
      return;
    }

    setLoading(true);
    try {
      if (!confirmationResult) throw new Error("Verification session expired.");
      await confirmationResult.confirm(otp);

      // Check if user already exists
      const clean = phone.trim().replace(/\D/g, "");
      const accountRef = doc(db, "phone_accounts", clean);
      const snap = await getDoc(accountRef);

      if (snap.exists()) {
        const data = snap.data();
        onAuthSuccess({
          phone: clean,
          seqId: data.seqId,
          name: data.name || `User-${data.seqId.slice(-4)}`,
          avatar: data.avatar || "",
        });
      } else {
        setStep("pin");
      }
    } catch (err: any) {
      setError("Invalid SMS verification code. Please check and re-enter.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin.trim().length !== 4) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);
    try {
      const clean = phone.trim().replace(/\D/g, "");
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
      const displayName = name.trim() || `User-${permanentSeqId.slice(-4)}`;

      await setDoc(doc(db, "phone_accounts", clean), {
        phone: clean,
        pin,
        seqId: permanentSeqId,
        name: displayName,
        avatar: "",
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", permanentSeqId), {
        phone: clean,
        name: displayName,
        avatar: "",
        online: true,
        lastSeen: serverTimestamp(),
      });

      onAuthSuccess({
        phone: clean,
        seqId: permanentSeqId,
        name: displayName,
        avatar: "",
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create account profile.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div id="recaptcha-container" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-[#111b21] border border-[#202c33] rounded-3xl p-6 shadow-2xl relative text-slate-100"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#00a884] flex items-center justify-center mx-auto text-white shadow-lg mb-4">
          <Smartphone size={28} />
        </div>

        <h2 className="text-xl font-bold text-center text-white">
          {step === "phone" && "Verify Your Phone"}
          {step === "otp" && "Enter SMS Code"}
          {step === "pin" && "Set Security PIN"}
        </h2>
        <p className="text-xs text-[#8696a0] text-center mt-1 mb-5">
          {step === "phone" && "We will send an SMS to verify your mobile number."}
          {step === "otp" && `Enter the 6-digit code sent to +91 ${phone}`}
          {step === "pin" && "Create a permanent 4-digit PIN to secure your account."}
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs text-[#8696a0] font-mono">+91</span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit Mobile Number"
                className="w-full pl-12 pr-3 py-2.5 text-xs rounded-xl bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] outline-none focus:border-[#00a884] font-mono"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] font-bold rounded-xl text-xs transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Sending SMS..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="••••••"
              className="w-full py-2.5 text-center text-lg tracking-[0.5em] font-mono rounded-xl bg-[#202c33] border border-[#2a3942] text-white outline-none focus:border-[#00a884]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] font-bold rounded-xl text-xs transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm Code"}
            </button>
          </form>
        )}

        {step === "pin" && (
          <form onSubmit={handleRegisterPin} className="space-y-4">
            <div>
              <label className="text-[10px] text-[#8696a0] font-bold uppercase tracking-wider block mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Koushik"
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#202c33] border border-[#2a3942] text-white placeholder-[#8696a0] outline-none focus:border-[#00a884]"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-[#8696a0] font-bold uppercase tracking-wider block mb-1">
                4-Digit Security PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full py-2 text-center text-base tracking-widest font-mono rounded-xl bg-[#202c33] border border-[#2a3942] text-white outline-none focus:border-[#00a884]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-[#111b21] font-bold rounded-xl text-xs transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Setting Up..." : "Complete Setup"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ==========================================
// 4. CHUNKED VIDEO PLAYER FOR LARGE VIDEOS
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
        const fullBase64 = snap.docs.map((d) => d.data().data).join("");
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
      <div className="w-56 h-36 rounded-xl bg-black/40 flex flex-col items-center justify-center p-3 text-center border border-white/10">
        <span className="w-5 h-5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-[10px] text-[#8696a0] font-mono">Loading Video...</p>
      </div>
    );
  }

  return (
    <div className="w-60 rounded-xl overflow-hidden bg-black">
      <video src={videoSrc || ""} controls className="w-full max-h-72 rounded-xl" preload="metadata" />
    </div>
  );
}

// ==========================================
// 5. INLINE VOICE NOTE PLAYER
// ==========================================
function VoiceNoteBubble({ audioSrc }: { audioSrc: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 w-56 py-1">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] flex-shrink-0"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col justify-center">
        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
          <div className={`h-full bg-[#00a884] ${isPlaying ? "animate-pulse w-full" : "w-1/3"}`} />
        </div>
        <span className="text-[9px] text-[#8696a0] font-mono mt-1">Voice message</span>
      </div>
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

// ==========================================
// 6. MASTER WHATSAPP-STYLE CHAT WORKSPACE
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
  read?: boolean;
  createdAt?: any;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [myFancyNumber, setMyFancyNumber] = useState("");
  const [myName, setMyName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [targetId, setTargetId] = useState("");
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; isGlobal: boolean }>({
    id: "global",
    name: "Global Lounge",
    isGlobal: true,
  });

  const [friendsList, setFriendsList] = useState<string[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Authentication Init
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

  // Bi-Directional Friend Synchronization
  useEffect(() => {
    if (!myFancyNumber) return;

    const qSent = query(
      collection(db, "chat_requests"),
      where("from", "==", myFancyNumber),
      where("status", "==", "accepted")
    );
    const unsubSent = onSnapshot(qSent, (snap) => {
      const ids = snap.docs.map((d) => d.data().to);
      setFriendsList((prev) => Array.from(new Set([...prev, ...ids])));
    });

    const qReceived = query(
      collection(db, "chat_requests"),
      where("to", "==", myFancyNumber),
      where("status", "==", "accepted")
    );
    const unsubReceived = onSnapshot(qReceived, (snap) => {
      const ids = snap.docs.map((d) => d.data().from);
      setFriendsList((prev) => Array.from(new Set([...prev, ...ids])));
    });

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [myFancyNumber]);

  // Real-Time Active Messages & Blue Ticks Handling
  useEffect(() => {
    if (!myFancyNumber) return;

    const messagesRef = activeChat.isGlobal
      ? collection(db, "global_messages")
      : collection(db, "private_chats", activeChat.id, "messages");

    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        // Mark message as read (Blue Tick) if received by me
        if (data.senderId !== myFancyNumber && !data.read) {
          updateDoc(docSnap.ref, { read: true });
        }
        return {
          id: docSnap.id,
          ...(data as Omit<Message, "id">),
        };
      });
      setMessages(fetched);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [activeChat, myFancyNumber]);

  // Real-Time Partner Typing Status Listener
  useEffect(() => {
    if (activeChat.isGlobal || !myFancyNumber) return;
    const typingRef = doc(db, "typing_status", activeChat.id);
    const unsub = onSnapshot(typingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const otherId = activeChat.name;
        setIsPartnerTyping(Boolean(data[otherId]));
      }
    });
    return () => unsub();
  }, [activeChat, myFancyNumber]);

  const updateTypingStatus = (typing: boolean) => {
    if (activeChat.isGlobal || !myFancyNumber) return;
    const typingRef = doc(db, "typing_status", activeChat.id);
    setDoc(typingRef, { [myFancyNumber]: typing }, { merge: true });
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    updateTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), 2000);
  };

  const sendMessage = async (
    text: string,
    type: "text" | "meme" | "image" | "video" | "chunked_video" | "audio" = "text",
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
        read: false,
        ...(extraPayload ? extraPayload : {}),
      });
      setMessage("");
      updateTypingStatus(false);
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

  const sendConnectionRequest = async (partnerId: string) => {
    if (!partnerId || partnerId === myFancyNumber) return;
    try {
      await addDoc(collection(db, "chat_requests"), {
        from: myFancyNumber,
        to: partnerId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      alert(`Request sent to ${partnerId}. Once accepted, conversation will open.`);
      setTargetId("");
    } catch (err) {
      console.error(err);
    }
  };

  const selectPrivateChat = (partnerId: string) => {
    if (!partnerId || partnerId === myFancyNumber) return;
    const roomId = [myFancyNumber, partnerId].sort().join("_");
    setActiveChat({ id: roomId, name: partnerId, isGlobal: false });
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0c1317] text-slate-100 overflow-hidden font-sans select-none relative">
      {/* WhatsApp Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#111b21] border-r border-[#202c33] transition-transform duration-200 md:static md:translate-x-0 ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3.5 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] font-bold">
              {myAvatar ? <img src={myAvatar} alt="Profile" className="w-full h-full rounded-full object-cover" /> : <User size={20} />}
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#e9edef]">{myName || "Lets Chat"}</h1>
              <p className="text-[10px] text-[#00a884] font-mono">ID: {myFancyNumber}</p>
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)} className="p-1 text-[#8696a0] hover:text-white md:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Search / Add Friend Bar */}
        <div className="p-2 border-b border-[#202c33]">
          <div className="relative">
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendConnectionRequest(targetId.trim())}
              placeholder="Search or add 10-digit ID..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-[#202c33] text-white placeholder-[#8696a0] outline-none font-mono"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-[#8696a0]" />
            {targetId && (
              <button
                onClick={() => sendConnectionRequest(targetId.trim())}
                className="absolute right-2 top-1.5 text-[10px] font-bold text-[#00a884]"
              >
                Add
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          <div
            onClick={() => {
              setActiveChat({ id: "global", name: "Global Lounge", isGlobal: true });
              setIsDrawerOpen(false);
            }}
            className={`p-3 cursor-pointer flex items-center gap-3 border-b border-[#202c33] ${
              activeChat.isGlobal ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884]">
              <Globe size={20} />
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-semibold text-[#e9edef]">Global Lounge</h4>
              <p className="text-xs text-[#8696a0] truncate">Community public channel</p>
            </div>
          </div>

          {friendsList.map((id) => (
            <div
              key={id}
              onClick={() => selectPrivateChat(id)}
              className={`p-3 cursor-pointer flex items-center gap-3 border-b border-[#202c33] ${
                activeChat.name === id ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884] font-mono font-bold text-xs">
                {id.slice(-2)}
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-sm font-semibold text-[#e9edef] font-mono">{id}</h4>
                <p className="text-xs text-[#8696a0] truncate">Direct conversation</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-[#0b141a] relative">
        {/* Chat Room Header */}
        <header className="h-14 bg-[#202c33] flex items-center justify-between px-4 z-10 border-b border-[#222e35]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDrawerOpen(true)} className="text-[#8696a0] md:hidden">
              <Menu size={22} />
            </button>
            <div className="w-9 h-9 rounded-full bg-[#111b21] flex items-center justify-center text-[#00a884] font-bold">
              {activeChat.isGlobal ? <Globe size={18} /> : <User size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#e9edef]">{activeChat.name}</h3>
              <p className="text-[11px] text-[#00a884] font-medium">
                {isPartnerTyping ? "typing..." : "online"}
              </p>
            </div>
          </div>
        </header>

        {/* WhatsApp Wallpaper Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0b141a]">
          {messages.map((msg) => {
            const isMe = msg.senderId === myFancyNumber;
            const timeStr = msg.createdAt?.toDate
              ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "...";

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`p-2.5 max-w-[80%] sm:max-w-[65%] rounded-2xl shadow-sm text-sm ${
                    isMe
                      ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                      : "bg-[#202c33] text-[#e9edef] rounded-tl-none"
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] text-[#00a884] font-mono font-bold mb-1">
                      {msg.senderName || msg.senderId}
                    </p>
                  )}

                  {msg.type === "chunked_video" && msg.mediaId && (
                    <ChunkedVideoPlayer mediaId={msg.mediaId} mimeType={msg.mimeType || "video/mp4"} />
                  )}

                  {msg.type === "audio" && <VoiceNoteBubble audioSrc={msg.text} />}

                  {msg.type === "text" && <p className="leading-relaxed">{msg.text}</p>}

                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[9px] text-[#8696a0] font-mono">{timeStr}</span>
                    {isMe && (
                      <CheckCheck
                        size={14}
                        className={msg.read ? "text-[#53bdeb]" : "text-[#8696a0]"}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* Composer Bar */}
        <div className="p-2.5 bg-[#202c33] flex items-center gap-2">
          <textarea
            rows={1}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(message);
              }
            }}
            placeholder="Type a message"
            className="flex-1 py-2 px-3 outline-none text-sm bg-[#2a3942] rounded-lg text-white placeholder-[#8696a0] resize-none"
          />

          <button
            onClick={() => sendMessage(message)}
            className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </main>

      <PhoneAuthModal
        isOpen={isAuthModalOpen}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}