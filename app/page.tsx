"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Phone, Video, Send } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      window.location.href = '/chat';
    } catch (error) {
      console.error("Login failed:", error);
      alert("Failed to login with Google");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/50 text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="inline-block p-4 bg-rose-500 rounded-full text-white mb-6"
        >
          <Heart size={48} fill="currentColor" />
        </motion.div>

        <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-rose-600 to-indigo-600 bg-clip-text text-transparent">
          Lets Chat
        </h1>
        <p className="text-gray-500 mb-8 font-medium">Connect with your friends & lover instantly ❤️</p>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-400 outline-none transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-400 outline-none transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-rose-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-colors"
            onClick={() => window.location.href = '/chat'}
          >
            Enter the Love World
          </motion.button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or continue with</span></div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </motion.button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-rose-400">
          <div className="flex flex-col items-center gap-1">
            <MessageCircle size={20} />
            <span className="text-[10px] font-bold uppercase">Instant Chat</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Phone size={20} />
            <span className="text-[10px] font-bold uppercase">Voice Call</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Video size={20} />
            <span className="text-[10px] font-bold uppercase">Video Call</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
