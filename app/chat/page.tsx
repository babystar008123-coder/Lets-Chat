"use client";

import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from "firebase/firestore";

// Firebase Configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerification",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lets-chat-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lets-chat-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lets-chat-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function WhatsAppClone() {
  const [myPhone, setMyPhone] = useState("");
  const [myName, setMyName] = useState("Mr Black");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Phone Auth Inputs
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  // Navigation
  const [activeTab, setActiveTab] = useState<"chats" | "status" | "calls">("chats");
  const [activeChat, setActiveChat] = useState<{ id: string; name: string; avatar?: string } | null>(null);

  // Contacts & Messages
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // In-chat Media & Menus
  const [showMenu, setShowMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Check saved session on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem("wa_phone");
    const savedName = localStorage.getItem("wa_name");
    if (savedPhone) {
      setMyPhone(savedPhone);
      setMyName(savedName || "Mr Black");
      setIsLoggedIn(true);
    }
  }, []);

  // Update online presence
  useEffect(() => {
    if (!myPhone) return;
    const userRef = doc(db, "wa_users", myPhone);
    setDoc(userRef, { name: myName, phone: myPhone, online: true, lastSeen: serverTimestamp() }, { merge: true });

    const handleUnload = () => {
      setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };
  }, [myPhone, myName]);

  // Handle Login / Registration
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneInput.replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }
    const finalName = nameInput.trim() || "User " + clean.slice(-4);
    setMyPhone(clean);
    setMyName(finalName);
    setIsLoggedIn(true);

    localStorage.setItem("wa_phone", clean);
    localStorage.setItem("wa_name", finalName);

    await setDoc(doc(db, "wa_users", clean), {
      phone: clean,
      name: finalName,
      online: true,
      lastSeen: serverTimestamp()
    }, { merge: true });
  };

  // Sync Contacts for this user
  useEffect(() => {
    if (!myPhone) return;
    const q = collection(db, "wa_users", myPhone, "contacts");
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setContacts(list);
    });
    return () => unsub();
  }, [myPhone]);

  // Add Contact by 10-digit Phone Number
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newContactPhone.replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }
    if (clean === myPhone) {
      alert("You cannot add yourself.");
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, "wa_users", clean));
      const contactName = userSnap.exists() ? userSnap.data().name : "User " + clean.slice(-4);

      // Add to my contacts
      await setDoc(doc(db, "wa_users", myPhone, "contacts", clean), {
        phone: clean,
        name: contactName,
        updatedAt: serverTimestamp()
      });

      // Add me to their contacts
      await setDoc(doc(db, "wa_users", clean, "contacts", myPhone), {
        phone: myPhone,
        name: myName,
        updatedAt: serverTimestamp()
      });

      setNewContactPhone("");
      setShowNewChatModal(false);
      setActiveChat({ id: clean, name: contactName });
    } catch (err) {
      alert("Error adding contact.");
    }
  };

  // Real-time messages for active chat room
  useEffect(() => {
    if (!activeChat || !myPhone) return;

    const roomId = [myPhone, activeChat.id].sort().join("_");
    const q = query(
      collection(db, "wa_messages"),
      where("chatId", "==", roomId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data });

        // Mark incoming messages as read (Blue Ticks)
        if (data.receiverPhone === myPhone && data.read === false) {
          updateDoc(doc(db, "wa_messages", docSnap.id), {
            read: true,
            status: "read",
            readAt: serverTimestamp()
          });
        }
      });
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [activeChat, myPhone]);

  // Send Message with 3-State WhatsApp Ticks
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const textToSend = inputText.trim();
    setInputText("");

    const roomId = [myPhone, activeChat.id].sort().join("_");

    // Check if recipient is online for Delivered tick
    let initialStatus = "sent";
    try {
      const recSnap = await getDoc(doc(db, "wa_users", activeChat.id));
      if (recSnap.exists() && recSnap.data().online) {
        initialStatus = "delivered";
      }
    } catch (err) {}

    await addDoc(collection(db, "wa_messages"), {
      chatId: roomId,
      senderPhone: myPhone,
      receiverPhone: activeChat.id,
      senderName: myName,
      text: textToSend,
      type: "text",
      read: false,
      status: initialStatus,
      createdAt: serverTimestamp()
    });
  };

  // Media / Photo upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const isImg = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const roomId = [myPhone, activeChat.id].sort().join("_");

      await addDoc(collection(db, "wa_messages"), {
        chatId: roomId,
        senderPhone: myPhone,
        receiverPhone: activeChat.id,
        senderName: myName,
        mediaUrl: base64,
        type: isImg ? "image" : isVideo ? "video" : "file",
        fileName: file.name,
        read: false,
        status: "sent",
        createdAt: serverTimestamp()
      });
    };
    reader.readAsDataURL(file);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (activeChat) {
            const roomId = [myPhone, activeChat.id].sort().join("_");
            await addDoc(collection(db, "wa_messages"), {
              chatId: roomId,
              senderPhone: myPhone,
              receiverPhone: activeChat.id,
              senderName: myName,
              mediaUrl: base64Audio,
              type: "audio",
              duration: recordSec,
              read: false,
              status: "sent",
              createdAt: serverTimestamp()
            });
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSec(0);
      recordTimerRef.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch (err) {
      alert("Microphone permission required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "now";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // Exact WhatsApp Ticks
  const renderTicks = (m: any) => {
    if (m.senderPhone !== myPhone) return null;
    if (m.status === "read" || m.read) {
      // Double Blue Tick
      return <span className="text-[#53bdeb] font-extrabold ml-1 text-xs">✓✓</span>;
    }
    if (m.status === "delivered") {
      // Double Gray Tick
      return <span className="text-[#8696a0] font-bold ml-1 text-xs">✓✓</span>;
    }
    // Single Gray Tick
    return <span className="text-[#8696a0] font-bold ml-1 text-xs">✓</span>;
  };

  // ================= LOGIN SCREEN =================
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full max-w-md mx-auto bg-[#111b21] text-[#e9edef] p-6 select-none font-sans">
        <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center text-4xl shadow-xl mb-6">
          💬
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome to WhatsApp</h1>
        <p className="text-xs text-[#8696a0] text-center mb-8">Enter your phone number to start messaging your friends.</p>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#8696a0] uppercase tracking-wider block mb-1">
              Your Name
            </label>
            <input
              type="text"
              placeholder="e.g. Koushik"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full bg-[#202c33] border border-[#2a3942] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00a884]"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#8696a0] uppercase tracking-wider block mb-1">
              Phone Number (10 Digits)
            </label>
            <input
              type="tel"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full bg-[#202c33] border border-[#2a3942] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#00a884]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-black font-extrabold text-sm shadow-md active:scale-98 transition mt-3"
          >
            Agree and Continue
          </button>
        </form>
      </div>
    );
  }

  // ================= MAIN WHATSAPP APP =================
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-[#0b141a] text-[#e9edef] font-sans overflow-hidden select-none relative">
      {!activeChat ? (
        /* ================= 1. WHATSAPP HOME (CHATS LIST) ================= */
        <div className="flex-1 flex flex-col h-full bg-[#111b21]">
          {/* Top WhatsApp Green Bar */}
          <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
            <h1 className="text-xl font-bold tracking-tight text-[#e9edef]">WhatsApp</h1>
            <div className="flex items-center gap-4 text-[#aebac1]">
              <button onClick={() => cameraInputRef.current?.click()} className="text-lg">📷</button>
              <button onClick={() => setShowNewChatModal(true)} className="text-lg">🔍</button>
              <button
                onClick={() => {
                  if (confirm("Logout?")) {
                    localStorage.clear();
                    setIsLoggedIn(false);
                  }
                }}
                className="text-lg"
              >
                ⋮
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Chats, Status, Calls) */}
          <div className="h-11 bg-[#202c33] flex items-center justify-around text-xs font-bold uppercase tracking-wider border-b border-[#222e35]">
            <button
              onClick={() => setActiveTab("chats")}
              className={`flex-1 h-full flex items-center justify-center relative ${
                activeTab === "chats" ? "text-[#00a884]" : "text-[#8696a0]"
              }`}
            >
              Chats {contacts.length > 0 && `(${contacts.length})`}
              {activeTab === "chats" && <span className="absolute bottom-0 inset-x-4 h-0.5 bg-[#00a884]" />}
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`flex-1 h-full flex items-center justify-center relative ${
                activeTab === "status" ? "text-[#00a884]" : "text-[#8696a0]"
              }`}
            >
              Updates
              {activeTab === "status" && <span className="absolute bottom-0 inset-x-4 h-0.5 bg-[#00a884]" />}
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              className={`flex-1 h-full flex items-center justify-center relative ${
                activeTab === "calls" ? "text-[#00a884]" : "text-[#8696a0]"
              }`}
            >
              Calls
              {activeTab === "calls" && <span className="absolute bottom-0 inset-x-4 h-0.5 bg-[#00a884]" />}
            </button>
          </div>

          {/* Chats Feed List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]">
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-[#8696a0] text-xs flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center text-3xl mb-3">
                  💬
                </div>
                <p className="font-bold text-white text-sm mb-1">No chats yet</p>
                <p className="max-w-xs text-xs">Tap the green button below to start a chat with your friend's phone number.</p>
              </div>
            ) : (
              contacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setActiveChat(c)}
                  className="flex items-center gap-3.5 p-3.5 hover:bg-[#202c33] cursor-pointer active:bg-[#222e35] transition"
                >
                  <div className="w-12 h-12 rounded-full bg-[#6b7b84] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white text-base truncate">{c.name}</h3>
                      <span className="text-[11px] text-[#8696a0]">today</span>
                    </div>
                    <p className="text-xs text-[#8696a0] truncate mt-0.5 font-mono">📱 {c.phone || c.id}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Floating Action Button (New Chat FAB) */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#00a884] hover:bg-[#06cf9c] text-black shadow-2xl flex items-center justify-center text-2xl active:scale-95 transition"
            title="New Chat"
          >
            💬
          </button>
        </div>
      ) : (
        /* ================= 2. 1-ON-1 CHAT ROOM ================= */
        <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
          {/* Header */}
          <div className="h-16 px-3 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] z-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveChat(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#aebac1] hover:text-white"
              >
                ←
              </button>
              <div className="w-10 h-10 rounded-full bg-[#6b7b84] flex items-center justify-center text-white font-bold text-sm">
                {activeChat.name[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white leading-tight">{activeChat.name}</h2>
                <p className="text-[11px] text-[#00a884]">online</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[#aebac1]">
              <button onClick={() => alert("Video call starting...")} className="text-base">📹</button>
              <button onClick={() => alert("Voice call starting...")} className="text-base">📞</button>
              <button onClick={() => setShowMenu(!showMenu)} className="text-base">⋮</button>
            </div>
          </div>

          {/* Three-dots Menu */}
          {showMenu && (
            <div className="absolute right-3 top-14 w-44 bg-[#233138] rounded-xl shadow-2xl p-1.5 z-30 border border-[#2a3942] space-y-1">
              <button
                onClick={() => {
                  alert("Contact details");
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-[#182229] rounded-lg"
              >
                View contact
              </button>
              <button
                onClick={() => {
                  if (confirm("Clear this chat?")) setMessages([]);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#182229] rounded-lg font-bold"
              >
                Clear chat
              </button>
            </div>
          )}

          {/* Messages Thread with Wallpaper */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.map((m) => {
              const isMe = m.senderPhone === myPhone;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} w-full`}>
                  <div
                    className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm shadow-md ${
                      isMe
                        ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                        : "bg-[#202c33] text-[#e9edef] rounded-tl-none"
                    }`}
                  >
                    {/* Media */}
                    {m.type === "image" && (
                      <img src={m.mediaUrl} alt="Photo" className="max-w-full rounded-xl mb-1 object-cover max-h-60" />
                    )}
                    {m.type === "video" && (
                      <video src={m.mediaUrl} controls className="max-w-full rounded-xl mb-1 max-h-60" />
                    )}
                    {m.type === "audio" && (
                      <div className="py-1">
                        <audio src={m.mediaUrl} controls className="max-w-[200px] h-8" />
                      </div>
                    )}

                    {/* Text */}
                    {m.type === "text" && <p className="leading-relaxed break-words">{m.text}</p>}

                    {/* Timestamp & Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#8696a0]">
                      <span>{formatTime(m.createdAt)}</span>
                      {renderTicks(m)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice recording active indicator */}
          {isRecording && (
            <div className="mx-2 mb-2 p-2.5 rounded-full bg-[#202c33] border border-[#00a884] flex items-center justify-between text-xs text-white">
              <span className="animate-pulse text-[#00a884] font-bold">🔴 Recording... {recordSec}s</span>
              <button onClick={stopRecording} className="px-3 py-1 bg-[#00a884] text-black font-bold rounded-full">
                Send Voice ➤
              </button>
            </div>
          )}

          {/* WhatsApp Bottom Composer */}
          <div className="p-2 bg-[#202c33] flex items-center gap-2 z-10">
            <div className="flex-1 flex items-center bg-[#2a3942] rounded-full px-3 py-1.5">
              <button
                type="button"
                onClick={() => alert("Emoji drawer")}
                className="text-[#8696a0] hover:text-white mr-2 text-base"
              >
                😊
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Message"
                className="flex-1 bg-transparent text-sm text-white placeholder-[#8696a0] outline-none"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#8696a0] hover:text-white mx-1.5 text-base"
              >
                📎
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="text-[#8696a0] hover:text-white ml-1 text-base"
              >
                📷
              </button>
            </div>

            {/* Mic or Send */}
            {inputText.trim() ? (
              <button
                onClick={handleSendMessage}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-black flex items-center justify-center font-bold text-base shadow-lg transition active:scale-95 flex-shrink-0"
              >
                ➤
              </button>
            ) : (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-11 h-11 rounded-full ${
                  isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#00a884] text-black"
                } flex items-center justify-center font-bold text-base shadow-lg transition active:scale-95 flex-shrink-0`}
              >
                🎤
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleMediaUpload} className="hidden" />

      {/* Modal: New Chat by Phone */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#202c33] border border-[#2a3942] rounded-2xl p-5 w-full max-w-xs shadow-2xl">
            <h3 className="font-bold text-white text-base mb-3">Start New Chat</h3>
            <form onSubmit={handleAddContact} className="space-y-3">
              <input
                type="tel"
                maxLength={10}
                placeholder="Friend's 10-digit Phone"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#00a884]"
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#111b21] text-[#8696a0] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#00a884] text-black text-xs font-extrabold shadow"
                >
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}