"use client";
import React, { createContext, useContext, useState } from "react";

interface NotificationContextType {
  notify: (msg: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notify: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl animate-bounce">
          {toast}
        </div>
      )}
    </NotificationContext.Provider>
  );
}
