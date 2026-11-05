"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart, Flame, Laugh, MessageSquareQuote, Search } from "lucide-react";

export interface TamilMeme {
  id: string;
  url: string;
  actor: string;
  movie: string;
  quote: string;
  tag: "comedy" | "romance" | "punch" | "dialogues";
}

const MEME_DATABASE: TamilMeme[] = [
  // Comedy
  {
    id: "vadivelu_1",
    actor: "Vadivelu",
    movie: "Winner",
    quote: "Venaam... Valikidhu... Azhudhuduven!",
    tag: "comedy",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=VadiveluWinner",
  },
  {
    id: "vadivelu_2",
    actor: "Vadivelu",
    movie: "Chandramukhi",
    quote: "Maapla! Vechittanya aappu!",
    tag: "comedy",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=VadiveluShock",
  },
  {
    id: "goundamani_1",
    actor: "Goundamani",
    movie: "Karakattakkaran",
    quote: "Adhu ennada adhu... Soppana Sundari!",
    tag: "comedy",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=GoundamaniClassic",
  },
  {
    id: "santhanam_1",
    actor: "Santhanam",
    movie: "Boss Engira Bhaskaran",
    quote: "Nanbenda! Endha naalaiku naan marapen?",
    tag: "comedy",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=SanthanamNanbenda",
  },
  // Romance
  {
    id: "vijay_1",
    actor: "Thalapathy Vijay",
    movie: "Kushi",
    quote: "Chellame... Un kooda pesumbodhu mattum dhaan ulagame marakkudhu.",
    tag: "romance",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=VijayKushi",
  },
  {
    id: "surya_1",
    actor: "Suriya",
    movie: "Vinaithaandi Varuvaayaa",
    quote: "Jessie... Enakku unna thavira vera edhuvume venaam.",
    tag: "romance",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuryaRomance",
  },
  {
    id: "dhanush_1",
    actor: "Dhanush",
    movie: "3",
    quote: "Kannazhaga... Kaalazhaga... En uyir nee dhaan.",
    tag: "romance",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=DhanushMoonu",
  },
  {
    id: "maddy_1",
    actor: "Madhavan",
    movie: "Alaipayuthey",
    quote: "Naan unna virumbala... Aana nee illama ennala irukka mudiyadhu.",
    tag: "romance",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=MaddyAlai",
  },
  // Punch
  {
    id: "rajini_1",
    actor: "Superstar Rajini",
    movie: "Baasha",
    quote: "Naan oru thadava sonna... Nooru thadava sonna maadhiri!",
    tag: "punch",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=RajiniBaasha",
  },
  {
    id: "ajith_1",
    actor: "Thala Ajith",
    movie: "Mankatha",
    quote: "No rules, no limits. It is my game!",
    tag: "punch",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=AjithMankatha",
  },
  {
    id: "kamal_1",
    actor: "Kamal Haasan",
    movie: "Vikram",
    quote: "Aarambikkalaangala? Paathukalam!",
    tag: "punch",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=KamalVikram",
  },
  // Dialogues
  {
    id: "dial_1",
    actor: "Romantic Vibes",
    movie: "Tamil Mood",
    quote: "Un kooda pesina dhaan en day complete aagum ❤️",
    tag: "dialogues",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SweetLover",
  },
  {
    id: "dial_2",
    actor: "Playful Anger",
    movie: "Tamil Mood",
    quote: "Reply panna evvalavu neram da unakku? 😤",
    tag: "dialogues",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=AngryCute",
  },
];

interface MemePanelProps {
  onSelect: (item: { url: string; quote: string; actor: string; movie: string }) => void;
}

export default function MemePanel({ onSelect }: MemePanelProps) {
  const [activeTab, setActiveTab] = useState<"comedy" | "romance" | "punch" | "dialogues">("comedy");
  const [search, setSearch] = useState("");

  const filteredMemes = MEME_DATABASE.filter(
    (item) =>
      item.tag === activeTab &&
      (item.actor.toLowerCase().includes(search.toLowerCase()) ||
        item.quote.toLowerCase().includes(search.toLowerCase()) ||
        item.movie.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="w-88 sm:w-[420px] bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden z-50 flex flex-col"
    >
      {/* Category Pills Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-2xl border border-slate-800">
          {(
            [
              { key: "comedy", label: "Comedy", icon: Laugh },
              { key: "romance", label: "Romance", icon: Heart },
              { key: "punch", label: "Punch", icon: Flame },
              { key: "dialogues", label: "Dialogues", icon: MessageSquareQuote },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Input */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor or quote..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-800/80 text-slate-200 border border-slate-700/60 placeholder-slate-500 outline-none focus:ring-1 focus:ring-rose-500"
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
        </div>
      </div>

      {/* Grid of Actor Reaction Cards */}
      <div className="p-3 grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
        {filteredMemes.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-xs text-slate-500 font-medium">
            No reactions found matching your filter.
          </div>
        ) : (
          filteredMemes.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onSelect({
                  url: item.url,
                  quote: item.quote,
                  actor: item.actor,
                  movie: item.movie,
                })
              }
              className="cursor-pointer group flex flex-col p-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-rose-500/50 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={item.url}
                  alt={item.actor}
                  className="w-9 h-9 rounded-xl bg-slate-700 p-0.5 object-cover"
                />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-200 truncate">{item.actor}</p>
                  <p className="text-[10px] text-rose-400 truncate">{item.movie}</p>
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/80 mt-auto">
                <p className="text-[11px] text-slate-300 font-medium italic line-clamp-2 leading-snug">
                  "{item.quote}"
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}