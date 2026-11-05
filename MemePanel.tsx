"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart, Flame, Laugh, MessageSquareQuote } from "lucide-react";

interface MemeItem {
  id: string;
  url: string;
  label: string;
  punch: string;
  actor: string;
}

const TAMIL_VAULT: Record<"comedy" | "romance" | "punch" | "dialogues", MemeItem[]> = {
  comedy: [
    {
      id: "vadivelu_ahaa",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=VadiveluAhaa",
      label: "Ahaa!",
      punch: "Naan apdiye shock aayitten!",
      actor: "Vadivelu",
    },
    {
      id: "vadivelu_saravanan",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=EnnaKoduma",
      label: "Enna Koduma",
      punch: "Enna koduma Saravanan idhu!",
      actor: "Vadivelu",
    },
    {
      id: "goundamani_arasiyal",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=GoundamaniPunch",
      label: "Arasiyal",
      punch: "Arasiyalla idhellam saadharanamappa!",
      actor: "Goundamani",
    },
    {
      id: "santhanam_sarcasm",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=SanthanamFunny",
      label: "Apdidhana?",
      punch: "Romba mukkiyam, mudhala kelambu!",
      actor: "Santhanam",
    },
    {
      id: "vivek_social",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=VivekComedy",
      label: "Idhu Eppadi Irukku",
      punch: "Innaiku sethaa naalaiku paalu!",
      actor: "Vivek",
    },
    {
      id: "vadivelu_building",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=BuildingStrong",
      label: "Building Strong",
      punch: "Building strong-u, basement-u weak-u!",
      actor: "Vadivelu",
    },
  ],
  romance: [
    {
      id: "vijay_chellame",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=VijayChellame",
      label: "Chellame",
      punch: "Unna paartha podhum di!",
      actor: "Thalapathy Vijay",
    },
    {
      id: "surya_vtv",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuryaRomance",
      label: "Jessie Feel",
      punch: "En melodiku nee dhaan lyrical partner!",
      actor: "Suriya",
    },
    {
      id: "dhanush_moonu",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dhanush3Love",
      label: "Moonu Love",
      punch: "Kannazhaga... Kaalazhaga...",
      actor: "Dhanush",
    },
    {
      id: "maddy_alaipayuthey",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=MaddyAlaipayuthey",
      label: "Sakthi Sakthi",
      punch: "Naan unna virumbala, un mela aasa padala!",
      actor: "Madhavan",
    },
    {
      id: "karthi_paiyaa",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=KarthiPaiyaa",
      label: "En Kadhal Solla",
      punch: "En kadhal solla neram illai...",
      actor: "Karthi",
    },
  ],
  punch: [
    {
      id: "rajini_baasha",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=RajiniBaasha",
      label: "Baasha Mass",
      punch: "Naan oru thadava sonna, nooru thadava sonna maadhiri!",
      actor: "Superstar Rajini",
    },
    {
      id: "ajith_mankatha",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=AjithMankatha",
      label: "Mankatha DA",
      punch: "This is my game, and I play it my way!",
      actor: "Thala Ajith",
    },
    {
      id: "kamal_virumaandi",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=KamalVirumaandi",
      label: "Virumaandi",
      punch: "Mannikka therinjavan manushan, kettu therinjavan periyavan!",
      actor: "Kamal Haasan",
    },
    {
      id: "vijay_ghilli",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=VijayGhilli",
      label: "All Are Welcome",
      punch: "Vaazhkai oru vattam da, inga thothavan jeippan!",
      actor: "Thalapathy Vijay",
    },
  ],
  dialogues: [
    {
      id: "dial_love1",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SweetVoice",
      label: "Love Propose",
      punch: "Ulagathula romba pudichadhu un kooda pesuradhu dhaan ❤️",
      actor: "Romantic Tamil",
    },
    {
      id: "dial_fight",
      url: "https://api.dicebear.com/7.x/bottts/svg?seed=AngryLover",
      label: "Kovam",
      punch: "Pesaama irundha kola panirven paathukko! 😤",
      actor: "Sweet Anger",
    },
    {
      id: "dial_care",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=LoveCare",
      label: "Care",
      punch: "Saaptiya illaya? Poi modhalla saapdu! 🍚",
      actor: "Pure Care",
    },
  ],
};

export default function MemePanel({
  onSelect,
}: {
  onSelect: (item: { url: string; punch: string; actor: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<"comedy" | "romance" | "punch" | "dialogues">("comedy");

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-84 sm:w-96 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-rose-500/20 border border-rose-200/80 overflow-hidden z-50 flex flex-col"
    >
      {/* Category Tabs */}
      <div className="grid grid-cols-4 p-1.5 bg-rose-50/70 border-b border-rose-100 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("comedy")}
          className={`flex items-center justify-center gap-1 py-2 rounded-2xl font-bold transition-all ${
            activeTab === "comedy"
              ? "bg-rose-500 text-white shadow-md shadow-rose-300"
              : "text-gray-600 hover:text-rose-600"
          }`}
        >
          <Laugh size={14} />
          <span>Comedy</span>
        </button>
        <button
          onClick={() => setActiveTab("romance")}
          className={`flex items-center justify-center gap-1 py-2 rounded-2xl font-bold transition-all ${
            activeTab === "romance"
              ? "bg-rose-500 text-white shadow-md shadow-rose-300"
              : "text-gray-600 hover:text-rose-600"
          }`}
        >
          <Heart size={14} />
          <span>Love</span>
        </button>
        <button
          onClick={() => setActiveTab("punch")}
          className={`flex items-center justify-center gap-1 py-2 rounded-2xl font-bold transition-all ${
            activeTab === "punch"
              ? "bg-rose-500 text-white shadow-md shadow-rose-300"
              : "text-gray-600 hover:text-rose-600"
          }`}
        >
          <Flame size={14} />
          <span>Punch</span>
        </button>
        <button
          onClick={() => setActiveTab("dialogues")}
          className={`flex items-center justify-center gap-1 py-2 rounded-2xl font-bold transition-all ${
            activeTab === "dialogues"
              ? "bg-rose-500 text-white shadow-md shadow-rose-300"
              : "text-gray-600 hover:text-rose-600"
          }`}
        >
          <MessageSquareQuote size={14} />
          <span>Dial</span>
        </button>
      </div>

      {/* Grid of Cards */}
      <div className="p-3 grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
        {TAMIL_VAULT[activeTab].map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect({ url: item.url, punch: item.punch, actor: item.actor })}
            className="group relative cursor-pointer rounded-2xl bg-gradient-to-br from-white to-rose-50/40 p-2 border border-rose-100 hover:border-rose-400 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center overflow-hidden"
          >
            <div className="w-14 h-14 rounded-full bg-rose-100/60 p-1 mb-1.5 shadow-inner">
              <img src={item.url} alt={item.label} className="w-full h-full object-cover rounded-full" />
            </div>
            <p className="text-xs font-black text-gray-800 line-clamp-1">{item.label}</p>
            <p className="text-[10px] text-rose-500 font-semibold mb-1">{item.actor}</p>
            <div className="w-full bg-rose-500/10 rounded-xl px-2 py-1 mt-auto">
              <p className="text-[10px] text-gray-700 italic font-medium line-clamp-2 leading-tight">
                "{item.punch}"
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}