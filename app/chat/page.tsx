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
  deleteDoc,
  runTransaction
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
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

// System notification trigger
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

// Tamil & English Meme Sticker Vault
const STICKER_PACKS = [
  {
    category: "Vadivelu Comedy",
    items: [
      { id: "v1", title: "Kaipulla", url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyZGNkcGpic3ZuczRkaWxneWF1MmVheWFuZGJiN2RkeTZ4ZnFudm11YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YSdvQxlheVHxQw5hEa/200.gif" },
      { id: "v2", title: "Shock Aayitten", url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNnEzanNlZHJibTYwYjZzazd3NG55OW5zY3g3cmhkeHM4NnVybXU4MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ESYT0mj1mUyrjr5kDW/200_d.gif" },
      { id: "v3", title: "Sing in the Rain", url: "https://media4.giphy.com/media/v1.Y2lkPTZjMDliOTUyd2I5Mjk3OTl4eHA1Z3hpbjBsejRyMHdoYXkzYXNucTk5aTNpODk3MCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YuWeSpstyR92U5cP0y/200w.gif" },
      { id: "v4", title: "Aahaa", url: "https://media.giphy.com/media/26FPGIqLMr2vvR052/giphy.gif" }
    ]
  },
  {
    category: "Tamil Mass",
    items: [
      { id: "m1", title: "Rajini Baasha", url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUycWc4eW8wMGt5ZWN3dnZ1MWFvZHBsNW92cnNkN3cybnN6aXh3emxucyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3S7dHcfGYlxvqjtHqn/200w.gif" },
      { id: "m2", title: "Vijay Ghilli", url: "https://media2.giphy.com/avatars/whistleadi/pnrBneA9iDRq.png" },
      { id: "m3", title: "Thalapathy Smile", url: "https://media.giphy.com/media/26gJzcY0d402t55sI/giphy.gif" },
      { id: "m4", title: "Rajini Mass", url: "https://media.giphy.com/media/3o6wrt11j6WNuM3kPu/giphy.gif" }
    ]
  },
  {
    category: "Love & Reactions",
    items: [
      { id: "l1", title: "Tamil Love", url: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyaXE3MGk2dDAybnpmaHpheGI0a3Ezdzlpb3cwd2diYTVvNTl1OWJrcSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/ddxgdaMGp1GVZTOHS6/giphy.gif" },
      { id: "l2", title: "Heart Love", url: "https://media.giphy.com/media/26FLdm964upqVm98s/giphy.gif" },
      { id: "l3", title: "Awesome", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" },
      { id: "l4", title: "Laughing", url: "https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif" }
    ]
  },
  {
    category: "Trending English",
    items: [
      { id: "e1", title: "Cat Vibing", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZhcXpnNDhhM2p5Z2g4NGgxcXN5Y3JtNWd2eG9mN3Z0eXVhOTM1eSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/MDJ9IbxxvDUQM/giphy.gif" },
      { id: "e2", title: "Doge Wow", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ29va3I3eGZjc3B0Mnl5N25vaHhyY3k2MWVxdWwxcjR6YWw2MXB2dyZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/9C1nyePmmDlS552Emu/giphy.gif" },
      { id: "e3", title: "Pepe Frog", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHIxb3p1a2gxdnI2Z2JldDN5aXcxZWt0dzNreTVzZHA2NmN2c3l1eiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/13CoXDiaCcCoyk/giphy.gif" },
      { id: "e4", title: "Popcat", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Q0bWk2dmk5N2pmeWp1cTZxcHRnd2Q4ZjhpZHVxdmdwbWVtc2ptYiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/osAcIGJnJ0sjpp3Qg8/giphy.gif" }
    ]
  }
];

// Chunked Video Streaming Player (>800KB)
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
      <div className="w-52 h-32 rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-3 border border-slate-800 text-center">
        <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-[10px] text-cyan-400 font-mono font-bold">Streaming Video...</p>
      </div>
    );
  }

  return (
    <div className="w-56 rounded-2xl overflow-hidden bg-black border border-slate-800">
      <video src={videoSrc || ""} controls className="w-full max-h-72 rounded-2xl" preload="metadata" />
    </div>
  );
}

export default function MasterChatApplication() {
  const [myId, setMyId] = useState<string>("");
  const [myName, setMyName] = useState<string>("Mr Black");
  const [myPhone, setMyPhone] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [phoneInput, setPhoneInput] = useState<string>("");
  const [pinInput, setPinInput] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const [contacts, setContacts] = useState<Array<{ id: string; name: string; online?: boolean }>>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchFriendId, setSearchFriendId] = useState<string>("");
  const [requestStatusMsg, setRequestStatusMsg] = useState<string>("");

  const [activePartner, setActivePartner] = useState<{ id: string; name: string; online?: boolean } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>("");

  const [unreadMap, setUnreadMap] = useState<Record<string, { count: number; lastText: string }>>({});

  const [showStickers, setShowStickers] = useState<boolean>(false);
  const [showMediaModal, setShowMediaModal] = useState<boolean>(false);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState<boolean>(false);
  const [chatTheme, setChatTheme] = useState<"sunset" | "cyan" | "emerald">("sunset");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSec, setRecordSec] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activePartnerRef = useRef(activePartner);

  useEffect(() => {
    activePartnerRef.current = activePartner;
  }, [activePartner]);

  // Load Saved Login & Setup Notifications on Mount
  useEffect(() => {
    const savedPhone = localStorage.getItem("letschat_perm_phone");
    const savedId = localStorage.getItem("letschat_perm_id");
    const savedName = localStorage.getItem("letschat_perm_name");

    if (savedPhone && savedId) {
      setMyPhone(savedPhone);
      setMyId(savedId);
      setMyName(savedName || "Mr Black");
      setIsLoggedIn(true);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Set User Online Presence
  useEffect(() => {
    if (!myId) return;
    const userDocRef = doc(db, "users", myId);
    setDoc(userDocRef, { online: true, name: myName, lastSeen: serverTimestamp() }, { merge: true });

    const handleUnload = () => {
      setDoc(userDocRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      setDoc(userDocRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };
  }, [myId, myName]);

  // Handle Login & Sequential 10-Digit Fancy ID Assignment
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneInput.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10 || pinInput.length !== 4) {
      alert("Please enter a valid 10-digit mobile number and 4-digit PIN.");
      return;
    }

    setLoginLoading(true);
    try {
      const accountRef = doc(db, "phone_accounts", cleanPhone);
      const accountSnap = await getDoc(accountRef);

      let seqId = "";
      let userName = "Mr Black";

      if (accountSnap.exists()) {
        const data = accountSnap.data();
        if (data.pin !== pinInput) {
          alert("Incorrect 4-digit PIN for this phone number.");
          setLoginLoading(false);
          return;
        }
        seqId = data.seqId;
        userName = data.name || "Mr Black";
      } else {
        const counterRef = doc(db, "metadata", "id_counter");
        const assignedNum = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let nextVal = 7;
          if (counterDoc.exists()) {
            nextVal = (counterDoc.data().current || 6) + 1;
          }
          transaction.set(counterRef, { current: nextVal }, { merge: true });
          return nextVal;
        });

        seqId = String(assignedNum).padStart(10, "0");
        await setDoc(accountRef, {
          phone: cleanPhone,
          pin: pinInput,
          seqId,
          name: userName,
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, "users", seqId), {
          phone: cleanPhone,
          name: userName,
          online: true,
          lastSeen: serverTimestamp()
        });
      }

      setMyPhone(cleanPhone);
      setMyId(seqId);
      setMyName(userName);
      setIsLoggedIn(true);

      localStorage.setItem("letschat_perm_phone", cleanPhone);
      localStorage.setItem("letschat_perm_id", seqId);
      localStorage.setItem("letschat_perm_name", userName);
    } catch (err) {
      alert("Error connecting to server. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Zero-Discovery Confidential Contacts (Strictly Empty for New Users)
  useEffect(() => {
    if (!myId) return;

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

  // Unread Tracker & Push Notification Trigger
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
        map[sId].lastText = data.text || (data.type === "sticker" ? "🎭 Sticker" : data.type === "video" ? "📹 Video" : "📷 Photo");
      });

      setUnreadMap(map);

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (!activePartnerRef.current || activePartnerRef.current.id !== data.senderId) {
              playNotificationChime();
              showNotificationAlert("Lets Chat: " + (data.senderName || "Friend"), data.text || "New message received", data.senderId);
            }
          }
        });
      }
      isInitial = false;
    });

    return () => unsubscribe();
  }, [myId]);

  // Messages in Active Room with Real-Time Blue Ticks
  useEffect(() => {
    if (!activePartner || !myId) return;

    const roomId = [myId, activePartner.id].sort().join("_");
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", roomId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data });

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
  }, [activePartner, myId]);

  // Send 10-Digit Fancy ID Friend Request
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = searchFriendId.trim().replace(/\D/g, "");
    if (cleanTarget.length !== 10) {
      setRequestStatusMsg("Please enter a valid 10-digit ID (e.g. 0000000008).");
      return;
    }
    if (cleanTarget === myId) {
      setRequestStatusMsg("You cannot add your own ID.");
      return;
    }

    try {
      const targetUserDoc = await getDoc(doc(db, "users", cleanTarget));
      if (!targetUserDoc.exists()) {
        setRequestStatusMsg("No user registered with ID: " + cleanTarget);
        return;
      }

      await addDoc(collection(db, "chat_requests"), {
        fromId: myId,
        fromName: myName,
        toId: cleanTarget,
        toName: targetUserDoc.data().name || "User " + cleanTarget.slice(-4),
        status: "pending",
        createdAt: serverTimestamp()
      });

      setRequestStatusMsg("Request sent to " + cleanTarget + "! They will appear once accepted.");
      setSearchFriendId("");
      setTimeout(() => setRequestStatusMsg(""), 3500);
    } catch (err) {
      setRequestStatusMsg("Failed to send request.");
    }
  };

  const handleAcceptRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, "chat_requests", req.reqDocId), {
        status: "accepted",
        acceptedAt: serverTimestamp()
      });
      const newFriend = { id: req.fromId, name: req.fromName || "Friend " + req.fromId.slice(-4) };
      setActivePartner(newFriend);
    } catch (e) {}
  };

  const handleOpenChat = async (contact: { id: string; name: string }) => {
    setActivePartner(contact);
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

  // Send Message with 3-State WhatsApp Tick Logic
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePartner) return;

    const textToSend = inputText.trim();
    setInputText("");

    const roomId = [myId, activePartner.id].sort().join("_");

    let initialStatus = "sent";
    try {
      const recSnap = await getDoc(doc(db, "users", activePartner.id));
      if (recSnap.exists() && recSnap.data().online) {
        initialStatus = "delivered";
      }
    } catch (err) {}

    await addDoc(collection(db, "messages"), {
      chatId: roomId,
      senderId: myId,
      receiverId: activePartner.id,
      senderName: myName,
      text: textToSend,
      type: "text",
      read: false,
      status: initialStatus,
      createdAt: serverTimestamp()
    });
  };

  const handleSendSticker = async (stickerUrl: string) => {
    if (!activePartner) return;
    setShowStickers(false);
    const roomId = [myId, activePartner.id].sort().join("_");
    await addDoc(collection(db, "messages"), {
      chatId: roomId,
      senderId: myId,
      receiverId: activePartner.id,
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
    if (!file || !activePartner) return;

    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    const reader = new FileReader();

    if (isVideo && file.size > 800 * 1024) {
      setUploadProgress(10);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const mediaId = "vid_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
        const CHUNK_SIZE = 700 * 1024;
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          const slice = base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await addDoc(collection(db, "media_chunks", mediaId, "chunks"), {
            index: i,
            data: slice
          });
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        const roomId = [myId, activePartner.id].sort().join("_");
        await addDoc(collection(db, "messages"), {
          chatId: roomId,
          senderId: myId,
          receiverId: activePartner.id,
          senderName: myName,
          mediaId,
          type: "chunked_video",
          mimeType: file.type || "video/mp4",
          read: false,
          status: "sent",
          createdAt: serverTimestamp()
        });
        setUploadProgress(null);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const roomId = [myId, activePartner.id].sort().join("_");
        await addDoc(collection(db, "messages"), {
          chatId: roomId,
          senderId: myId,
          receiverId: activePartner.id,
          senderName: myName,
          mediaUrl: base64Data,
          type: isImage ? "image" : isVideo ? "video" : "file",
          fileName: file.name,
          read: false,
          status: "sent",
          createdAt: serverTimestamp()
        });
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        audioInputRef.current?.click();
        return;
      }
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
          if (activePartner) {
            const roomId = [myId, activePartner.id].sort().join("_");
            await addDoc(collection(db, "messages"), {
              chatId: roomId,
              senderId: myId,
              receiverId: activePartner.id,
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
      audioInputRef.current?.click();
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const handleClearChatHistory = async () => {
    if (!activePartner) return;
    if (!confirm("Are you sure you want to clear this chat history?")) return;
    setShowThreeDotsMenu(false);
    const roomId = [myId, activePartner.id].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", roomId));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => deleteDoc(doc(db, "messages", d.id)));
    setMessages([]);
  };

  const formatTime = (ts: any) => {
    if (!ts) return "now";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // WhatsApp-Style 3-State Ticks
  const renderTicks = (m: any) => {
    if (m.senderId !== myId) return null;
    if (m.status === "read" || m.read) {
      return <span className="text-cyan-400 font-extrabold ml-1 text-xs">✓✓</span>;
    }
    if (m.status === "delivered") {
      return <span className="text-slate-400 font-bold ml-1 text-xs">✓✓</span>;
    }
    return <span className="text-slate-500 font-bold ml-1 text-xs">✓</span>;
  };

  const mediaMessages = messages.filter((m) => m.type === "image" || m.type === "video" || m.type === "chunked_video");

  return (
    <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-black text-white font-sans select-none flex flex-row">
      {/* 
        LEFT SIDEBAR: WHATSAPP / TELEGRAM CONTACTS DIRECTORY
        Mobile (<768px): Full-screen when no partner active, hidden when chatting
        PC (>=768px): Dual-pane fixed left sidebar
      */}
      <aside
        className={`w-full md:w-80 lg:w-96 h-full flex flex-col bg-slate-950 border-r border-slate-900 z-30 transition-all ${
          activePartner ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-slate-900 bg-black/60 flex-shrink-0">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center font-bold text-white text-base">
                  {myName[0]}
                </div>
              </div>
              <div>
                <h1 className="font-extrabold text-base text-white leading-tight">{myName}</h1>
                <p className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">My Profile</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm("Logout from current session?")) {
                  localStorage.clear();
                  setIsLoggedIn(false);
                }
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-slate-400 border border-slate-800"
            >
              Logout
            </button>
          </div>

          {/* Prominent 10-Digit Fancy ID Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-md flex items-center justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Your Confidential Fancy ID</p>
              <p className="text-xl font-mono font-black text-rose-500 tracking-wider mt-0.5">{myId}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(myId);
                alert("Copied 10-digit ID: " + myId);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-cyan-500/30 transition shadow"
            >
              Copy
            </button>
          </div>

          {/* Search Friend Input Bar */}
          <form onSubmit={handleSendRequest} className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
              <input
                type="text"
                maxLength={10}
                placeholder="Enter friend's 10-digit ID..."
                value={searchFriendId}
                onChange={(e) => setSearchFriendId(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs shadow-md hover:brightness-110 transition flex items-center gap-1"
            >
              <span>+</span> Request
            </button>
          </form>
          {requestStatusMsg && <p className="text-[11px] text-cyan-400 mt-1 px-1 font-medium">{requestStatusMsg}</p>}
        </div>

        {/* Pending Requests Banner */}
        {pendingRequests.length > 0 && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">
              Pending Friend Requests ({pendingRequests.length})
            </p>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div key={req.reqDocId} className="flex items-center justify-between bg-black/70 p-2.5 rounded-xl border border-rose-500/30">
                  <div>
                    <p className="text-xs font-bold text-white">{req.fromName}</p>
                    <p className="text-[10px] text-cyan-400 font-mono">ID: {req.fromId}</p>
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

        {/* Contacts Directory List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>🛡️</span>
            <span>My Confidential Contacts</span>
          </div>

          {contacts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center mt-6">
              <div className="w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mb-3 shadow-inner">
                🔒
              </div>
              <p className="font-bold text-white text-sm mb-1">Your contact list is private & empty</p>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Enter your friend's 10-digit Fancy ID above to send a private connection request. Once accepted, they will appear here.
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const unreadInfo = unreadMap[contact.id];
              const hasUnread = unreadInfo && unreadInfo.count > 0;
              const isSelected = activePartner?.id === contact.id;

              return (
                <div
                  key={contact.id}
                  onClick={() => handleOpenChat(contact)}
                  className={`relative p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border ${
                    isSelected
                      ? "bg-slate-900 border-rose-500/60 shadow-lg"
                      : hasUnread
                      ? "bg-slate-900/90 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40"
                      : "bg-slate-950/70 border-slate-900 hover:border-slate-800"
                  }`}
                >
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

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm truncate">{contact.name}</span>
                      {hasUnread && (
                        <span className="bg-emerald-500 text-black font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-[0_0_10px_#10b981]">
                          {unreadInfo.count > 99 ? "99+" : unreadInfo.count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {contact.id}</p>

                    {hasUnread ? (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 rounded-lg px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="truncate">
                          {unreadInfo.count} new {unreadInfo.count === 1 ? "message" : "messages"} • Not viewed yet
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">Tap to chat</p>
                    )}
                  </div>

                  <span className="text-xs bg-slate-900 text-cyan-400 px-2.5 py-1 rounded-xl font-bold border border-cyan-500/20">
                    Chat
                  </span>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 
        RIGHT PANEL: WHATSAPP 1-ON-1 CHAT WORKSPACE
        Mobile: Full-screen when partner active, hidden on contacts list
        PC: Expands into right main panel (Telegram Desktop style)
      */}
      <main
        className={`flex-1 flex flex-col h-full w-full overflow-hidden bg-black relative ${
          !activePartner ? "hidden md:flex items-center justify-center" : "flex"
        }`}
      >
        {!activePartner ? (
          <div className="text-center p-8 text-slate-500 max-w-sm">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-rose-500 mx-auto mb-3 border border-slate-800">
              💬
            </div>
            <h3 className="text-base font-bold text-white mb-1">No conversation selected</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your conversations are private and confidential. Select a friend on the left or enter a 10-digit Fancy ID to start messaging.
            </p>
          </div>
        ) : (
          <>
            <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 bg-slate-950 border-b border-slate-900 z-20 flex-shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  onClick={() => setActivePartner(null)}
                  className="p-1.5 -ml-1 text-slate-300 hover:text-white md:hidden"
                  title="Back"
                >
                  ←
                </button>
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-rose-500/40 flex items-center justify-center text-white font-bold text-sm">
                  {activePartner.name[0]}
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-100 leading-tight">{activePartner.name}</h2>
                  <p className="text-[10px] text-cyan-400 font-mono mt-0.5">● Online • ID: {activePartner.id}</p>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all text-base"
                >
                  ⋮
                </button>

                {showThreeDotsMenu && (
                  <div className="absolute right-0 top-12 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-30 space-y-1">
                    <button
                      onClick={() => {
                        setShowMediaModal(true);
                        setShowThreeDotsMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-xl flex items-center gap-2.5 text-left"
                    >
                      📁 Media, Links and Docs
                    </button>
                    <button
                      onClick={() => {
                        setChatTheme(chatTheme === "sunset" ? "cyan" : chatTheme === "cyan" ? "emerald" : "sunset");
                        setShowThreeDotsMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-xl flex items-center gap-2.5 text-left"
                    >
                      🎨 Change Chat Theme
                    </button>
                    <div className="border-t border-slate-800 pt-1">
                      <button
                        onClick={handleClearChatHistory}
                        className="w-full px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 rounded-xl flex items-center gap-2.5 text-left font-bold"
                      >
                        🗑️ Clear Chat History
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </header>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <p className="text-sm font-bold text-white mb-1">Say Hi to {activePartner.name}! 👋</p>
                  <p className="text-xs text-slate-400">Your direct conversation is completely confidential.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === myId;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} w-full`}>
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[65%] shadow-lg ${
                          isMe
                            ? chatTheme === "cyan"
                              ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-black font-medium rounded-br-none"
                              : chatTheme === "emerald"
                              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-black font-medium rounded-br-none"
                              : "bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-br-none shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                            : "bg-slate-900 text-white border border-slate-800 rounded-bl-none shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 opacity-90 text-[11px] font-bold">
                          <span>{isMe ? myName : m.senderName || "Friend"}</span>
                        </div>

                        {m.type === "text" && <p className="text-sm font-medium leading-relaxed break-words">{m.text}</p>}

                        {m.type === "sticker" && (
                          <div className="w-36 sm:w-44 aspect-square flex items-center justify-center p-1 mb-1 bg-black/40 rounded-xl">
                            <img src={m.stickerUrl} alt="Sticker" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}

                        {m.type === "image" && (
                          <img src={m.mediaUrl} alt="Attachment" className="w-52 rounded-xl object-cover mb-1" />
                        )}

                        {m.type === "video" && (
                          <div className="w-52 rounded-xl overflow-hidden bg-black mb-1">
                            <video src={m.mediaUrl} controls className="w-full max-h-72 rounded-xl" preload="metadata" />
                          </div>
                        )}

                        {m.type === "chunked_video" && m.mediaId && (
                          <ChunkedVideoPlayer mediaId={m.mediaId} mimeType={m.mimeType || "video/mp4"} />
                        )}

                        {m.type === "audio" && (
                          <div className="flex items-center gap-2 w-48 sm:w-56 py-1">
                            <audio src={m.mediaUrl} controls className="w-full h-8" />
                          </div>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                          <span>{formatTime(m.createdAt)}</span>
                          {renderTicks(m)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {uploadProgress !== null && (
              <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-slate-900 border border-cyan-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono font-bold text-cyan-300">Streaming Video... {uploadProgress}%</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Please wait</span>
              </div>
            )}

            {isRecording && (
              <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 text-white flex items-center justify-between shadow-xl animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                  <span className="text-xs font-bold font-mono">Recording Audio Note... {recordSec}s</span>
                </div>
                <button
                  onClick={stopVoiceRecording}
                  className="text-xs bg-white text-rose-600 px-3 py-1 rounded-xl font-black shadow-md"
                >
                  Send Voice ➤
                </button>
              </div>
            )}

            {/* WhatsApp-Styled Bottom Composer Bar */}
            <div className="p-2 sm:p-3 bg-black border-t border-slate-900 w-full flex-shrink-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="max-w-4xl mx-auto flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#1f2c34] rounded-full px-3 py-1.5 border border-slate-800">
                  <button
                    onClick={() => setShowStickers(true)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Meme Stickers"
                  >
                    😊
                  </button>

                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Message..."
                    className="flex-1 py-1 px-2.5 outline-none text-sm bg-transparent resize-none max-h-24 text-slate-100 placeholder-slate-400 font-medium"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Attach Media"
                  >
                    📎
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Take Photo with Camera"
                  >
                    📷
                  </button>
                </div>

                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
                <input ref={audioInputRef} type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />

                {inputText.trim() ? (
                  <button
                    onClick={handleSendMessage}
                    className="w-11 h-11 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 flex items-center justify-center text-white font-bold shadow-lg transition-transform active:scale-95 flex-shrink-0"
                    title="Send Message"
                  >
                    ➤
                  </button>
                ) : (
                  <button
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`w-11 h-11 rounded-full ${
                      isRecording ? "bg-rose-600 animate-pulse text-white" : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black"
                    } flex items-center justify-center font-bold shadow-lg transition-transform active:scale-95 flex-shrink-0 text-base`}
                    title="Voice Note"
                  >
                    🎤
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Stickers Slide-Up Drawer */}
      {showStickers && (
        <div className="fixed bottom-0 inset-x-0 max-h-[70vh] bg-slate-950 border-t border-rose-500/40 rounded-t-[32px] shadow-2xl z-50 flex flex-col p-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900 mb-2">
            <span className="text-xs font-bold text-rose-400">Tamil & English Meme Stickers</span>
            <button onClick={() => setShowStickers(false)} className="text-xs text-slate-500 font-bold px-2 py-1">✕ Close</button>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[50vh] p-1">
            {STICKER_PACKS.map((pack) => (
              <div key={pack.category}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{pack.category}</p>
                <div className="grid grid-cols-4 gap-2">
                  {pack.items.map((stk) => (
                    <div
                      key={stk.id}
                      onClick={() => handleSendSticker(stk.url)}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-1 hover:border-rose-500 cursor-pointer transition flex items-center justify-center"
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

      {/* Media, Links & Docs Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">📁 Media, Links and Docs</h3>
              <button onClick={() => setShowMediaModal(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2 mt-2">
              {mediaMessages.length === 0 ? (
                <p className="col-span-3 text-center text-xs text-slate-500 py-8">No photos or videos shared yet.</p>
              ) : (
                mediaMessages.map((m) => (
                  <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-black border border-slate-800">
                    {m.type === "image" ? (
                      <img src={m.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-cyan-400 text-xl">📹</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}