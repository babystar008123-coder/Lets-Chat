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
  Sparkles,
  ArrowRight,
  Radio,
  Image as ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import MemePanel from "@/components/MemePanel";
import CallModal from "@/components/CallModal";
import HeartShower from "@/components/HeartShower";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAgora } from "@/hooks/useAgora";

interface Message {
  id: string;
  text: string;
  senderId: string;
  type: "text" | "meme" | "image" | "video" | "audio";
  memeMeta?: { punch: string; actor: string };
  createdAt?: any;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [showMemes, setShowMemes] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myFancyNumber, setMyFancyNumber] = useState("");
  const [targetId, setTargetId] = useState("");
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; isGlobal: boolean }>({
    id: "global",
    name: "Global Love Room",
    isGlobal: true,
  });
  const [recentChats, setRecentChats] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callIsVideo, setCallIsVideo] = useState(true);
  const [heartTrigger, setHeartTrigger] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    localVideoTrack,
    remoteUsers,
    isAudioMuted,
    isVideoEnabled,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useAgora();

  // Initialize Fancy ID
  useEffect(() => {
    const savedId =
      localStorage.getItem("lovechat_id") || `LC-777-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem("lovechat_id", savedId);
    setMyFancyNumber(savedId);

    const recents = JSON.parse(localStorage.getItem("lovechat_recents") || "[]");
    setRecentChats(recents);

    // Announce online presence in Firestore
    setDoc(doc(db, "users", savedId), { lastSeen: serverTimestamp(), online: true }, { merge: true });
  }, []);

  // Listen for real-time messages in active room
  useEffect(() => {
    const messagesRef = activeChat.isGlobal
      ? collection(db, "global_messages")
      : collection(db, "private_chats", activeChat.id, "messages");

    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Message, "id">),
          }))
        );
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      },
      (error) => {
        console.warn("Firestore snapshot listener:", error);
      }
    );

    return () => unsubscribe();
  }, [activeChat]);

  // Voice note recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordSec(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  const selectPrivateChat = (partnerId: string) => {
    if (!partnerId || partnerId === myFancyNumber) return;
    const roomId = [myFancyNumber, partnerId].sort().join("_");
    setActiveChat({ id: roomId, name: partnerId, isGlobal: false });
    setTargetId("");

    if (!recentChats.includes(partnerId)) {
      const updated = [partnerId, ...recentChats];
      setRecentChats(updated);
      localStorage.setItem("lovechat_recents", JSON.stringify(updated));
    }
  };

  const sendMessage = async (
    text: string,
    type: "text" | "meme" | "image" | "video" | "audio" = "text",
    memeMeta?: { punch: string; actor: string }
  ) => {
    if (!text.trim()) return;

    const messagesRef = activeChat.isGlobal
      ? collection(db, "global_messages")
      : collection(db, "private_chats", activeChat.id, "messages");

    try {
      await addDoc(messagesRef, {
        text,
        senderId: myFancyNumber,
        createdAt: serverTimestamp(),
        type,
        ...(memeMeta ? { memeMeta } : {}),
      });
      setMessage("");
      setShowMemes(false);
    } catch (e) {
      console.error("Message send failure:", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    try {
      const fileType = file.type.split("/")[0];
      const storageRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      const type = fileType === "image" ? "image" : fileType === "video" ? "video" : "audio";
      await sendMessage(downloadURL, type);
    } catch (err) {
      alert("Failed to upload media. Ensure Firebase Storage is initialized.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendVoiceNote = async () => {
    setIsRecording(false);
    const simulatedAudioUrl =
      "https://actions.google.com/sounds/v1/ambiences/outdoor_festival_ambience.ogg";
    await sendMessage(simulatedAudioUrl, "audio");
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
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans select-none relative">
      <HeartShower trigger={heartTrigger} />

      {/* Decorative ambient gradient backdrop */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Left Sidebar / Room Directory */}
      <div className="w-full md:w-88 flex flex-col bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-rose-100 dark:border-rose-950/40 z-20 shadow-2xl">
        {/* Brand & ID Badge */}
        <div className="p-5 border-b border-rose-100/60 dark:border-rose-950/40 bg-gradient-to-br from-rose-50/70 via-white to-indigo-50/30 dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                <Heart size={20} className="fill-white" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-rose-600 to-indigo-600 bg-clip-text text-transparent">
                  Lets Chat
                </h1>
                <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">
                  Love & Friends UI
                </p>
              </div>
            </div>
            <button
              onClick={triggerLoveBurst}
              className="p-2 rounded-2xl bg-rose-100/70 hover:bg-rose-200 text-rose-600 transition-all hover:scale-105 active:scale-95"
              title="Send Love Shower"
            >
              <Sparkles size={16} />
            </button>
          </div>

          {/* User's Fancy ID Card with Copy Button */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-rose-200/60 dark:border-rose-900/40 shadow-sm">
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Your Fancy ID</p>
              <p className="text-xs font-black text-rose-600 dark:text-rose-400 tracking-wider">
                {myFancyNumber || "Generating ID..."}
              </p>
            </div>
            <button
              onClick={copyMyId}
              className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/10 text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Fancy ID Search */}
          <div className="mt-3 relative">
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && selectPrivateChat(targetId.trim())}
              placeholder="Search lover's ID (e.g. LC-777-1234)..."
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-slate-800/60 text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-rose-400 transition-all"
            />
            <Search className="absolute left-3 top-3 text-gray-400" size={14} />
            {targetId && (
              <button
                onClick={() => selectPrivateChat(targetId.trim())}
                className="absolute right-2 top-2 p-1.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600"
              >
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Channels & Private Connections */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Global Love Room Channel */}
          <div
            onClick={() => setActiveChat({ id: "global", name: "Global Love Room", isGlobal: true })}
            className={`p-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between border ${
              activeChat.isGlobal
                ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 border-transparent scale-[1.02]"
                : "bg-white dark:bg-slate-800 hover:bg-rose-50/60 dark:hover:bg-slate-700/60 text-gray-700 dark:text-gray-200 border-rose-100 dark:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  activeChat.isGlobal ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600"
                }`}
              >
                <Globe size={18} />
              </div>
              <div>
                <p className="font-black text-sm">Global Love Room</p>
                <p className={`text-[10px] ${activeChat.isGlobal ? "text-rose-100" : "text-gray-400"}`}>
                  Public community stream
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>

          {/* Private Chat List */}
          <div className="pt-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2">
              Private Connections
            </p>
            {recentChats.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-rose-200/60 dark:border-slate-800 text-center">
                <p className="text-xs text-gray-400">No private chats yet.</p>
                <p className="text-[10px] text-rose-500 mt-1">Search a Fancy ID above to start 1-on-1!</p>
              </div>
            ) : (
              recentChats.map((id) => (
                <div
                  key={id}
                  onClick={() => selectPrivateChat(id)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between mb-1.5 border ${
                    activeChat.name === id
                      ? "bg-rose-500/10 dark:bg-rose-500/20 border-rose-400 text-rose-600 font-bold shadow-sm"
                      : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-rose-100 dark:border-slate-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-indigo-500 flex items-center justify-center text-white text-xs font-black shadow-sm">
                      {id.slice(-2)}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{id}</p>
                      <p className="text-[9px] text-gray-400">1-on-1 Private Love Chat</p>
                    </div>
                  </div>
                  <UserCheck size={14} className="text-rose-500" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Canvas */}
      <div className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-950">
        {/* Chat Room Header */}
        <div className="h-18 flex items-center justify-between px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-rose-100/60 dark:border-rose-950/40 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-rose-500/20 text-lg">
                {activeChat.isGlobal ? "❤️" : "💌"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-gray-900 dark:text-white text-base leading-tight">
                  {activeChat.name}
                </h2>
                {!activeChat.isGlobal && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">
                    Private
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
                <Radio size={12} className="animate-pulse" />
                Real-Time Connected
              </p>
            </div>
          </div>

          {/* Agora Audio & Video Calling Triggers */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => initiateCall(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-slate-800 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Voice Call"
            >
              <Phone size={15} />
              <span className="hidden sm:inline">Voice</span>
            </button>
            <button
              onClick={() => initiateCall(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-500 to-indigo-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all hover:scale-105 active:scale-95"
              title="Video Call"
            >
              <Video size={15} />
              <span className="hidden sm:inline">Video Call</span>
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <div className="w-16 h-16 rounded-3xl bg-rose-100/60 dark:bg-slate-800 flex items-center justify-center text-rose-500 text-3xl mb-3 animate-bounce">
                💌
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No messages in this room yet.</p>
              <p className="text-xs text-gray-400 mt-1">Send a Tamil actor meme or a love message to connect!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === myFancyNumber;
              const timeFormatted = msg.createdAt?.toDate
                ? msg.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Sending...";

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`p-4 rounded-3xl shadow-sm max-w-[85%] md:max-w-[65%] ${
                      isMe
                        ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-tr-none shadow-rose-500/20"
                        : "bg-white dark:bg-slate-800 text-gray-800 dark:text-white rounded-tl-none border border-rose-100/70 dark:border-slate-700/60 shadow-sm"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-extrabold mb-1.5 opacity-80 ${
                        isMe ? "text-rose-100" : "text-rose-500"
                      }`}
                    >
                      {msg.senderId}
                    </p>

                    {/* Tamil Actor Meme Card */}
                    {msg.type === "meme" && (
                      <div className="rounded-2xl overflow-hidden bg-black/10 dark:bg-black/30 p-2 space-y-2 border border-white/20">
                        <img
                          src={msg.text}
                          alt="Tamil Meme"
                          className="w-56 h-56 rounded-xl object-cover bg-white/10 mx-auto"
                        />
                        {msg.memeMeta && (
                          <div className="text-center p-1.5 bg-black/20 rounded-xl">
                            <p className="text-xs font-black italic">"{msg.memeMeta.punch}"</p>
                            <p className="text-[10px] opacity-80 mt-0.5">- {msg.memeMeta.actor}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image Attachment */}
                    {msg.type === "image" && (
                      <img
                        src={msg.text}
                        alt="Shared media"
                        className="w-64 max-h-80 object-cover rounded-2xl shadow-sm"
                      />
                    )}

                    {/* Video Attachment */}
                    {msg.type === "video" && (
                      <video src={msg.text} controls className="w-64 rounded-2xl shadow-sm" />
                    )}

                    {/* Audio / Voice Note */}
                    {msg.type === "audio" && (
                      <div className="flex items-center gap-3 w-64 py-1">
                        <div className="p-2 rounded-full bg-rose-500/20 text-rose-500">
                          <Mic size={18} />
                        </div>
                        <audio src={msg.text} controls className="w-full h-8" />
                      </div>
                    )}

                    {/* Standard Text */}
                    {msg.type === "text" && (
                      <p className="text-sm font-medium leading-relaxed break-words">{msg.text}</p>
                    )}

                    <p
                      className={`text-[9px] text-right mt-1.5 font-semibold opacity-70 ${
                        isMe ? "text-rose-100" : "text-gray-400"
                      }`}
                    >
                      {timeFormatted}
                    </p>
                  </motion.div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Dock & Connectors */}
        <div className="p-4 relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-rose-100/60 dark:border-rose-950/40">
          {isUploading && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl animate-bounce">
              Uploading media to love chat... 🚀
            </div>
          )}

          {/* Voice recording floating indicator */}
          {isRecording && (
            <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between p-3 rounded-2xl bg-rose-600 text-white shadow-xl animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                <span className="text-xs font-bold">Recording Voice Note... {recordSec}s</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRecording(false)}
                  className="text-xs bg-white/20 px-3 py-1 rounded-xl font-bold hover:bg-white/30"
                >
                  Cancel
                </button>
                <button
                  onClick={sendVoiceNote}
                  className="text-xs bg-white text-rose-600 px-3 py-1 rounded-xl font-black hover:bg-rose-50"
                >
                  Send Audio
                </button>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-2.5 rounded-3xl border border-rose-200/60 dark:border-rose-900/40 focus-within:ring-2 focus-within:ring-rose-500/40 transition-all shadow-inner">
            {/* Meme Vault Popover Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowMemes(!showMemes)}
                className={`p-2.5 rounded-2xl transition-all ${
                  showMemes
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105"
                    : "text-gray-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700"
                }`}
                title="Tamil Memes & Dialogues"
              >
                <Smile size={22} />
              </button>

              <AnimatePresence>
                {showMemes && (
                  <div className="absolute bottom-14 left-0 z-50">
                    <MemePanel
                      onSelect={(item) =>
                        sendMessage(item.url, "meme", { punch: item.punch, actor: item.actor })
                      }
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Text Box */}
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
              placeholder={`Send love to ${activeChat.name}...`}
              className="flex-1 py-2 px-3 outline-none text-sm bg-transparent resize-none max-h-32 text-gray-800 dark:text-white placeholder-gray-400 font-medium"
            />

            {/* File & Voice Controls */}
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all"
                title="Attach Media"
              >
                <Paperclip size={20} />
              </button>

              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`p-2.5 rounded-2xl transition-all ${
                  isRecording
                    ? "bg-rose-600 text-white animate-bounce"
                    : "text-gray-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700"
                }`}
                title="Voice Note"
              >
                <Mic size={20} />
              </button>
            </div>

            {/* Send Button */}
            <button
              onClick={() => sendMessage(message)}
              className="p-3 bg-gradient-to-tr from-rose-500 to-rose-600 text-white rounded-2xl shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Agora Video / Voice Call Screen Overlay */}
      {callActive && (
        <CallModal
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