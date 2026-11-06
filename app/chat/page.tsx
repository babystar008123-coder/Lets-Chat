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
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

async function showNotificationAlert(title: string, body: string, senderId: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const options = {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "msg-" + senderId,
      vibrate: [200, 100, 200]
    };
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (e) {}
}

const STICKER_PACKS = [
  {
    category: "Vadivelu Legends",
    items: [
      { id: "v1", title: "Aahaa", url: "https://media.giphy.com/media/26FPGIqLMr2vvR052/giphy.gif" },
      { id: "v2", title: "Enna Koduma Sir", url: "https://media.giphy.com/media/l1J9FiGxR61OcF2mI/giphy.gif" },
      { id: "v3", title: "Building Strong", url: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif" },
      { id: "v4", title: "Naan Appavey Sonnen", url: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif" }
    ]
  },
  {
    category: "Tamil Mass & Reactions",
    items: [
      { id: "m1", title: "Rajini Mass", url: "https://media.giphy.com/media/3o6wrt11j6WNuM3kPu/giphy.gif" },
      { id: "m2", title: "Thalapathy Smile", url: "https://media.giphy.com/media/26gJzcY0d402t55sI/giphy.gif" },
      { id: "m3", title: "Heart Love", url: "https://media.giphy.com/media/26FLdm964upqVm98s/giphy.gif" },
      { id: "m4", title: "Awesome", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" }
    ]
  }
];

export default function ChatApp() {
  const [myId, setMyId] = useState<string>("0000000007");
  const [myName, setMyName] = useState<string>("Mr Black");
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; online?: boolean }>>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchFriendId, setSearchFriendId] = useState<string>("");
  const [requestStatusMsg, setRequestStatusMsg] = useState<string>("");

  const [activeChat, setActiveChat] = useState<{ id: string; name: string; online?: boolean } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [unreadMap, setUnreadMap] = useState<Record<string, { count: number; lastText: string }>>({});

  const [showStickers, setShowStickers] = useState<boolean>(false);
  const [showMediaMenu, setShowMediaMenu] = useState<boolean>(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Request Notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    // Set user online
    if (myId) {
      setDoc(doc(db, "users", myId), { online: true, name: myName, lastSeen: serverTimestamp() }, { merge: true });
    }
  }, [myId, myName]);

  // Confidential Contacts & Requests (Empty by default for new users)
  useEffect(() => {
    if (!myId) return;

    // Incoming requests
    const qPending = query(
      collection(db, "chat_requests"),
      where("toId", "==", myId),
      where("status", "==", "pending")
    );
    const unsubPending = onSnapshot(qPending, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ reqDocId: d.id, ...d.data() }));
      setPendingRequests(list);
    });

    // Mutual accepted friends
    const q1 = query(collection(db, "chat_requests"), where("fromId", "==", myId), where("status", "==", "accepted"));
    const q2 = query(collection(db, "chat_requests"), where("toId", "==", myId), where("status", "==", "accepted"));

    const friendsMap = new Map<string, { id: string; name: string }>();
    const updateList = () => setContacts(Array.from(friendsMap.values()));

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.forEach((d) => {
        const data = d.data();
        friendsMap.set(data.toId, { id: data.toId, name: data.toName || "Friend " + data.toId.slice(-4) });
      });
      updateList();
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      snap.forEach((d) => {
        const data = d.data();
        friendsMap.set(data.fromId, { id: data.fromId, name: data.fromName || "Friend " + data.fromId.slice(-4) });
      });
      updateList();
    });

    return () => {
      unsubPending();
      unsub1();
      unsub2();
    };
  }, [myId]);

  // Unread tracker, Green Light indicator & Notification trigger
  useEffect(() => {
    if (!myId) return;

    let isInitial = true;
    const q = query(
      collection(db, "messages"),
      where("receiverId", "==", myId),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, { count: number; lastText: string }> = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const sId = data.senderId;
        if (!map[sId]) {
          map[sId] = { count: 0, lastText: data.text || "Media" };
        }
        map[sId].count += 1;
        map[sId].lastText = data.text || "New Message";
      });

      setUnreadMap(map);

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (!activeChatRef.current || activeChatRef.current.id !== data.senderId) {
              playNotificationChime();
              showNotificationAlert("Lets Chat: " + (data.senderName || "Friend"), data.text || "New message", data.senderId);
            }
          }
        });
      }
      isInitial = false;
    });

    return () => unsubscribe();
  }, [myId]);

  // Real-time messages in active room
  useEffect(() => {
    if (!activeChat || !myId) return;

    const chatId = [myId, activeChat.id].sort().join("_");
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data });

        // Mark as Read (Blue Tick)
        if (data.receiverId === myId && data.read === false) {
          updateDoc(doc(db, "messages", docSnap.id), {
            read: true,
            status: "read",
            readAt: serverTimestamp()
          });
        }
      });
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsubscribe();
  }, [activeChat, myId]);

  // Send 10-digit ID Friend Request
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchFriendId || searchFriendId.trim().length !== 10) {
      setRequestStatusMsg("Please enter a valid 10-digit ID (e.g. 0000000008)");
      return;
    }
    const targetId = searchFriendId.trim();
    if (targetId === myId) {
      setRequestStatusMsg("You cannot add yourself.");
      return;
    }

    try {
      await addDoc(collection(db, "chat_requests"), {
        fromId: myId,
        fromName: myName,
        toId: targetId,
        toName: "User " + targetId.slice(-4),
        status: "pending",
        createdAt: serverTimestamp()
      });
      setRequestStatusMsg("Request sent successfully to " + targetId);
      setSearchFriendId("");
      setTimeout(() => setRequestStatusMsg(""), 3000);
    } catch (e) {
      setRequestStatusMsg("Failed to send request.");
    }
  };

  const handleAcceptRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, "chat_requests", req.reqDocId), {
        status: "accepted",
        acceptedAt: serverTimestamp()
      });
    } catch (e) {}
  };

  // Open Chat Room
  const handleOpenChat = async (contact: { id: string; name: string }) => {
    setActiveChat(contact);
    setUnreadMap((prev) => {
      const next = { ...prev };
      delete next[contact.id];
      return next;
    });

    try {
      const q = query(
        collection(db, "messages"),
        where("receiverId", "==", myId),
        where("senderId", "==", contact.id),
        where("read", "==", false)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((d) => {
        updateDoc(doc(db, "messages", d.id), { read: true, status: "read" });
      });
    } catch (e) {}
  };

  // Send Message with 3-State Tick Logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const textToSend = inputText.trim();
    setInputText("");

    const chatId = [myId, activeChat.id].sort().join("_");

    // Check recipient online status for Delivered (Double tick) vs Net off (Single tick)
    let initialStatus = "sent"; // Single tick (Net off / Offline)
    try {
      const recSnap = await getDoc(doc(db, "users", activeChat.id));
      if (recSnap.exists() && recSnap.data().online) {
        initialStatus = "delivered"; // Double tick (Online / Received)
      }
    } catch (err) {}

    await addDoc(collection(db, "messages"), {
      chatId,
      senderId: myId,
      receiverId: activeChat.id,
      senderName: myName,
      text: textToSend,
      type: "text",
      read: false,
      status: initialStatus,
      createdAt: serverTimestamp()
    });
  };

  // Render WhatsApp-Style Ticks
  const renderTicks = (m: any) => {
    if (m.senderId !== myId) return null;
    if (m.status === "read" || m.read) {
      // Double Blue Tick (Viewed / Read)
      return <span className="text-cyan-400 font-extrabold ml-1 text-xs">✓✓</span>;
    }
    if (m.status === "delivered") {
      // Double Gray Tick (Online / Delivered)
      return <span className="text-slate-400 font-bold ml-1 text-xs">✓✓</span>;
    }
    // Single Gray Tick (Sent / Net off)
    return <span className="text-slate-500 font-bold ml-1 text-xs">✓</span>;
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (!activeChat) return;
    setShowStickers(false);
    const chatId = [myId, activeChat.id].sort().join("_");
    await addDoc(collection(db, "messages"), {
      chatId,
      senderId: myId,
      receiverId: activeChat.id,
      senderName: myName,
      stickerUrl,
      type: "sticker",
      read: false,
      status: "sent",
      createdAt: serverTimestamp()
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const isImg = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const chatId = [myId, activeChat.id].sort().join("_");
      await addDoc(collection(db, "messages"), {
        chatId,
        senderId: myId,
        receiverId: activeChat.id,
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

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (activeChat) {
            const chatId = [myId, activeChat.id].sort().join("_");
            await addDoc(collection(db, "messages"), {
              chatId,
              senderId: myId,
              receiverId: activeChat.id,
              senderName: myName,
              mediaUrl: base64Audio,
              type: "audio",
              duration: recordSeconds,
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
      setIsRecordingVoice(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert("Microphone permission required.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const handleClearChatHistory = async () => {
    if (!activeChat) return;
    if (!confirm("Are you sure you want to clear this chat history?")) return;
    setShowMediaMenu(false);
    const chatId = [myId, activeChat.id].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => deleteDoc(doc(db, "messages", d.id)));
    setMessages([]);
  };

  const formatTime = (ts: any) => {
    if (!ts) return "now";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-black text-white overflow-hidden select-none relative">
      {!activeChat ? (
        /* HOME / DIRECTORY SCREEN */
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-cyan-500/60 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-600 to-slate-900 flex items-center justify-center font-bold text-lg text-white">
                  {myName[0]}
                </div>
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-white leading-tight">{myName}</h1>
                <p className="text-[10px] text-cyan-400 font-bold tracking-widest">MY PROFILE</p>
              </div>
            </div>
            <span className="text-slate-400 text-lg">⚙️</span>
          </div>

          {/* Confidential ID Card */}
          <div className="mt-4 p-4 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Confidential ID</p>
              <p className="text-2xl font-black text-rose-500 tracking-wider font-mono mt-0.5">{myId}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(myId);
                alert("ID Copied: " + myId);
              }}
              className="px-3.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-cyan-500/30 transition shadow"
            >
              Copy
            </button>
          </div>

          {/* Search Friend Request Input Bar */}
          <form onSubmit={handleSendRequest} className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-3 text-slate-500 text-sm">🔍</span>
              <input
                type="text"
                maxLength={10}
                placeholder="Enter friend's 10-digit ID..."
                value={searchFriendId}
                onChange={(e) => setSearchFriendId(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs shadow-[0_0_12px_rgba(244,63,94,0.3)] hover:brightness-110 transition flex items-center gap-1"
            >
              <span>+</span> Request
            </button>
          </form>
          {requestStatusMsg && <p className="text-[11px] text-cyan-400 mt-1.5 px-1 font-medium">{requestStatusMsg}</p>}

          {/* Pending Incoming Requests */}
          {pendingRequests.length > 0 && (
            <div className="mt-4 p-3 bg-slate-900/90 border border-rose-500/40 rounded-2xl">
              <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-2">
                Incoming Friend Requests ({pendingRequests.length})
              </p>
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div key={req.reqDocId} className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-white">{req.fromName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {req.fromId}</p>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-lg shadow-[0_0_8px_#10b981]"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidential Contacts Section */}
          <div className="mt-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-400 text-sm">🛡️</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">My Confidential Contacts</h2>
            </div>

            {contacts.length === 0 ? (
              /* EMPTY DEFAULT STATE FOR NEW USERS */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-900 rounded-3xl mt-2">
                <span className="text-4xl mb-3 opacity-60">🔒</span>
                <p className="text-sm font-bold text-slate-300">No Contacts Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Your chat list is completely private. Enter your friend's 10-digit ID above to exchange requests and start messaging.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {contacts.map((contact) => {
                  const unreadInfo = unreadMap[contact.id];
                  const hasUnread = unreadInfo && unreadInfo.count > 0;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleOpenChat(contact)}
                      className={`relative p-3.5 rounded-3xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        hasUnread
                          ? "bg-slate-900/90 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40"
                          : "bg-slate-950/70 border-slate-900 hover:border-slate-800"
                      }`}
                    >
                      {/* Avatar with Pulsing Green Light Indicator */}
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-base text-cyan-400">
                          {contact.name[0].toUpperCase()}
                        </div>
                        {hasUnread && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-black shadow-[0_0_8px_#10b981]"></span>
                          </span>
                        )}
                      </div>

                      {/* Info & Unread Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white text-base truncate">{contact.name}</span>
                          {hasUnread && (
                            <span className="bg-emerald-500 text-black font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-[0_0_10px_#10b981]">
                              {unreadInfo.count > 99 ? "99+" : unreadInfo.count}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {contact.id}</p>

                        {hasUnread ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-2 py-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="truncate">
                              {unreadInfo.count} new {unreadInfo.count === 1 ? "message" : "messages"} • Not viewed yet
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 truncate mt-1">Tap to chat</p>
                        )}
                      </div>

                      <button
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          hasUnread
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : "bg-slate-900 text-cyan-400 border border-cyan-500/20"
                        }`}
                      >
                        Chat
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 1-ON-1 CHAT ROOM */
        <div className="flex-1 flex flex-col h-full bg-black relative">
          {/* Top Bar */}
          <div className="h-14 px-3 bg-slate-950/90 border-b border-slate-900 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveChat(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-cyan-400 hover:bg-slate-900"
              >
                ←
              </button>
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-400 text-sm">
                {activeChat.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white leading-tight">{activeChat.name}</h3>
                <p className="text-[10px] text-cyan-400 font-mono">ID: {activeChat.id}</p>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMediaMenu(!showMediaMenu)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                ⋮
              </button>

              {showMediaMenu && (
                <div className="absolute right-0 top-10 w-48 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50">
                  <button
                    onClick={() => {
                      alert("Media, Links & Docs view opened.");
                      setShowMediaMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800 rounded-xl"
                  >
                    📁 Media, Links and Docs
                  </button>
                  <button
                    onClick={handleClearChatHistory}
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 rounded-xl font-bold"
                  >
                    🗑️ Clear Chat History
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map((m) => {
              const isMe = m.senderId === myId;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] p-3.5 rounded-3xl text-sm shadow-md ${
                      isMe
                        ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-br-none shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                        : "bg-slate-900 text-white border border-slate-800 rounded-bl-none shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 opacity-90 text-[11px] font-bold">
                      <span>{isMe ? myName : m.senderName || "Friend"}</span>
                    </div>

                    {m.type === "text" && <p className="break-words leading-relaxed">{m.text}</p>}
                    {m.type === "sticker" && <img src={m.stickerUrl} alt="Sticker" className="w-36 h-36 object-contain rounded-2xl" />}
                    {m.type === "image" && <img src={m.mediaUrl} alt="Photo" className="max-w-full rounded-2xl max-h-60 object-cover" />}
                    {m.type === "video" && <video src={m.mediaUrl} controls className="max-w-full rounded-2xl max-h-60" />}
                    {m.type === "audio" && (
                      <div className="flex items-center gap-2 py-1">
                        <audio src={m.mediaUrl} controls className="max-w-[200px] h-8" />
                      </div>
                    )}

                    {/* Time & 3-Tick Indicators */}
                    <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-80">
                      <span>{formatTime(m.createdAt)}</span>
                      {renderTicks(m)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Stickers Drawer */}
          {showStickers && (
            <div className="h-64 bg-slate-950 border-t border-slate-800 p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400">Tamil Meme Stickers</span>
                <button onClick={() => setShowStickers(false)} className="text-xs text-slate-500">✕ Close</button>
              </div>
              <div className="space-y-3">
                {STICKER_PACKS.map((pack) => (
                  <div key={pack.category}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{pack.category}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {pack.items.map((stk) => (
                        <div
                          key={stk.id}
                          onClick={() => handleSendSticker(stk.url)}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-1 hover:border-cyan-500 cursor-pointer transition flex items-center justify-center"
                        >
                          <img src={stk.url} alt={stk.title} className="w-14 h-14 object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden File & Camera */}
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />

          {/* Voice Recording / Input Bar */}
          {isRecordingVoice ? (
            <div className="p-3 bg-slate-950 border-t border-rose-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-xs animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Recording Voice: {recordSeconds}s</span>
              </div>
              <button onClick={stopVoiceRecording} className="px-4 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-[0_0_10px_#f43f5e]">
                Send Audio ➤
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="p-2.5 bg-black border-t border-slate-900 flex items-center gap-2">
              <button type="button" onClick={() => setShowStickers(!showStickers)} className="w-9 h-9 rounded-full bg-slate-900 text-slate-400 hover:text-cyan-400 flex items-center justify-center text-base">
                😊
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full bg-slate-900 text-slate-400 hover:text-cyan-400 flex items-center justify-center text-sm">
                📎
              </button>
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-9 h-9 rounded-full bg-slate-900 text-slate-400 hover:text-cyan-400 flex items-center justify-center text-sm">
                📷
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button type="button" onClick={startVoiceRecording} className="w-9 h-9 rounded-full bg-slate-900 text-slate-400 hover:text-rose-400 flex items-center justify-center text-sm">
                🎤
              </button>
              <button type="submit" className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-black font-extrabold flex items-center justify-center shadow-[0_0_12px_#10b981] transition">
                ➤
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}