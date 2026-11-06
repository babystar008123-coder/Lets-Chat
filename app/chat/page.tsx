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
  setDoc,
  getDoc
} from "firebase/firestore";

// Firebase Config
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

// Soft futuristic notification chime
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
  } catch (e) {
    console.log("Audio play prevented:", e);
  }
}

// Trigger screen bar notification
async function showScreenBarNotification(senderName: string, senderId: string, text: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = `Lets Chat: ${senderName || "ID " + senderId}`;
  const options = {
    body: text || "????? ?????? ?????????? (New message)",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `msg-${senderId}`,
    vibrate: [200, 100, 200]
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (e) {
    console.error("Screen bar notification failed:", e);
  }
}

export default function ChatDashboard() {
  const [myId, setMyId] = useState<string>("0000000007");
  const [myName, setMyName] = useState<string>("Mr Black");
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([
    { id: "0000000008", name: "sk" },
    { id: "0000000011", name: "ferfverv" },
    { id: "0000000010", name: "Kunjuu" }
  ]);
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [unreadMap, setUnreadMap] = useState<Record<string, { count: number; lastText: string }>>({});
  const [notificationGranted, setNotificationGranted] = useState(false);
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Request Notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationGranted(true);
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          setNotificationGranted(perm === "granted");
        });
      }
    }
  }, []);

  // Listen for Unread Messages & Trigger Notifications
  useEffect(() => {
    if (!myId) return;

    let isInitialLoad = true;
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
          map[sId] = { count: 0, lastText: data.text || "Media / Sticker" };
        }
        map[sId].count += 1;
        map[sId].lastText = data.text || "Media / Sticker";
      });

      setUnreadMap(map);

      // Trigger Screen Bar Notification on incoming changes
      if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            // Only notify if not actively chatting with this user right now
            if (!activeChatRef.current || activeChatRef.current.id !== data.senderId) {
              playNotificationChime();
              showScreenBarNotification(data.senderName || "Friend", data.senderId, data.text);
            }
          }
        });
      }
      isInitialLoad = false;
    });

    return () => unsubscribe();
  }, [myId]);

  // Real-time messages for active chat room
  useEffect(() => {
    if (!activeChat) return;

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

        // Mark incoming messages as read when looking at the screen
        if (data.receiverId === myId && data.read === false) {
          updateDoc(doc(db, "messages", docSnap.id), { read: true });
        }
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeChat, myId]);

  // Open Chat and mark all unreads as viewed
  const handleOpenChat = async (contact: { id: string; name: string }) => {
    setActiveChat(contact);
    // Instant local cleanup
    setUnreadMap((prev) => {
      const next = { ...prev };
      delete next[contact.id];
      return next;
    });

    // Mark Firestore messages as read
    try {
      const q = query(
        collection(db, "messages"),
        where("receiverId", "==", myId),
        where("senderId", "==", contact.id),
        where("read", "==", false)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((d) => {
        updateDoc(doc(db, "messages", d.id), { read: true });
      });
    } catch (e) {
      console.error("Mark read error:", e);
    }
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const textToSend = inputText.trim();
    setInputText("");

    const chatId = [myId, activeChat.id].sort().join("_");
    await addDoc(collection(db, "messages"), {
      chatId,
      senderId: myId,
      receiverId: activeChat.id,
      senderName: myName,
      text: textToSend,
      read: false,
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-black text-white overflow-hidden select-none">
      {!activeChat ? (
        /* HOME / DIRECTORY SCREEN */
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center font-bold text-cyan-400">
                {myName[0]}
              </div>
              <div>
                <h1 className="font-bold text-lg text-white leading-tight">{myName}</h1>
                <p className="text-[11px] text-cyan-400 font-semibold tracking-wider">MY PROFILE</p>
              </div>
            </div>
            {!notificationGranted && (
              <button
                onClick={() => Notification.requestPermission().then((p) => setNotificationGranted(p === "granted"))}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 flex items-center gap-1"
              >
                ?? Alert On
              </button>
            )}
          </div>

          {/* Confidential ID Card */}
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Your Confidential ID</p>
              <p className="text-xl font-extrabold text-rose-500 tracking-wider font-mono mt-0.5">{myId}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(myId)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg border border-cyan-500/30 transition"
            >
              Copy
            </button>
          </div>

          {/* Contacts Section */}
          <div className="mt-6 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-400 text-sm">???</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">My Confidential Contacts</h2>
            </div>

            <div className="space-y-2.5">
              {contacts.map((contact) => {
                const unreadInfo = unreadMap[contact.id];
                const hasUnread = unreadInfo && unreadInfo.count > 0;

                return (
                  <div
                    key={contact.id}
                    onClick={() => handleOpenChat(contact)}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      hasUnread
                        ? "bg-slate-900/90 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40"
                        : "bg-slate-950/60 border-slate-900 hover:border-slate-800"
                    }`}
                  >
                    {/* Avatar with Pulsing Green Light */}
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

                    {/* Contact Info & Not Viewed Yet Indicator */}
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
                          <span className="truncate">Received from this ID & not viewed yet</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 truncate mt-1">Tap to chat</p>
                      )}
                    </div>

                    {/* Chat Action Button */}
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
          </div>
        </div>
      ) : (
        /* 1-ON-1 CHAT ROOM */
        <div className="flex-1 flex flex-col h-full bg-black">
          {/* Top Bar */}
          <div className="h-14 px-3 bg-slate-950/90 border-b border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveChat(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-cyan-400 hover:bg-slate-900"
              >
                ?
              </button>
              <div className="w-9 h-9 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-400 text-sm">
                {activeChat.name[0]}
              </div>
              <div>
                <h3 className="font-bold text-sm text-white leading-tight">{activeChat.name}</h3>
                <p className="text-[10px] text-emerald-400 font-mono">? Online • ID: {activeChat.id}</p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
            {messages.map((m) => {
              const isMe = m.senderId === myId;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                      isMe
                        ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-black font-medium rounded-br-none shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                        : "bg-slate-900 text-white border border-slate-800 rounded-bl-none shadow-md"
                    }`}
                  >
                    <p className="break-words">{m.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      <span>{isMe ? (m.read ? "?? Viewed" : "? Sent") : ""}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp Style Bottom Input Bar */}
          <form onSubmit={handleSendMessage} className="p-2.5 bg-black border-t border-slate-900 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center justify-center shadow-[0_0_12px_#10b981] transition"
            >
              ?
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
