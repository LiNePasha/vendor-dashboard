"use client";

import { useState, useEffect, useRef } from "react";
import usePOSStore from "@/app/stores/pos-store";

const SOUND_SRC = "/sounds/notify.mp3"; // ضع ملف الصوت هنا: public/sounds/notify.mp3

export default function NotificationBell({ onToggleSidebar, onOpenSidebar, soundEnabled = true }) {
  const [notificationCount, setNotificationCount] = useState(0);
  const audioContextRef = useRef(null);
  const audioElRef = useRef(null);
  const lastCountRef = useRef(0);
  const lastOrderIdsRef = useRef(new Set()); // 🔥 تتبع IDs بدل count
  const hasInitializedRef = useRef(false); // 🔥 منع الصوت أول مرة
  const isFetchingRef = useRef(false);
  
  // 🔥 استخدام Global State
  const fetchOrders = usePOSStore((state) => state.fetchOrders);
  const processingOrders = usePOSStore((state) => state.processingOrders);

  // Initialize Audio Context and Audio Element
  useEffect(() => {
    // Prepare audio element
    const audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1.0;
    audioElRef.current = audio;

    const unlockAudio = () => {
      // Unlock HTMLAudioElement
      try {
        if (audioElRef.current) {
          audioElRef.current.currentTime = 0;
          const p = audioElRef.current.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              // pause immediately to keep it unlocked
              audioElRef.current.pause();
              audioElRef.current.currentTime = 0;
            }).catch(() => {/* ignore */});
          }
        }
      } catch (_) {}

      // Unlock WebAudio
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (_) {}
    };

    document.addEventListener('click', unlockAudio, { once: true });
    return () => document.removeEventListener('click', unlockAudio);
  }, []);

  // Play STRONG notification sound (triple beep)
  const playNotificationSound = () => {
    try {
      // Try custom audio file first
      if (audioElRef.current) {
        audioElRef.current.currentTime = 0;
        audioElRef.current.play().catch(() => {
          // Fallback to WebAudio
          tryWebAudioBeep();
        });
        return;
      }
      // If no audio element, fallback to WebAudio
      tryWebAudioBeep();
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const tryWebAudioBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const playBeep = (frequency, startTime, duration) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.5, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      const now = ctx.currentTime;
      playBeep(880, now, 0.2);
      playBeep(1047, now + 0.25, 0.2);
      playBeep(880, now + 0.5, 0.3);
    } catch (_) {}
  };

  // Fetch processing orders
  const fetchProcessingOrders = async () => {
    // 🔥 Request guard - منع concurrent requests
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      
      // 🆕 جلب الطلبات من آخر 48 ساعة فقط
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
      const afterDate = twoDaysAgo.toISOString();
      
      await fetchOrders({ 
        status: 'processing', 
        per_page: 100,
        after: afterDate
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      isFetchingRef.current = false;
    }
  };
  
  // 🔥 تحديث العداد لما processingOrders يتغير
  useEffect(() => {
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    
    // فلترة الطلبات الغير مقروءة
    const unreadOrders = processingOrders.filter(order => 
      !readNotifications.includes(order.id.toString())
    );
    
    // 🔥 تتبع الـ order IDs الفعلية
    const currentOrderIds = new Set(unreadOrders.map(order => order.id.toString()));
    
    // 🔥 البحث عن orders جديدة فعلاً
    const newOrderIds = [...currentOrderIds].filter(id => !lastOrderIdsRef.current.has(id));
    
    setNotificationCount(currentOrderIds.size);
    
    // 🔥 شغل الصوت فقط لو في orders جديدة وبعد التهيئة
    if (newOrderIds.length > 0 && hasInitializedRef.current && soundEnabled) {
      playNotificationSound();
      if (typeof onOpenSidebar === 'function') {
        onOpenSidebar();
      }
    }
    
    // 🔥 حفظ الـ IDs الحالية
    lastOrderIdsRef.current = currentOrderIds;
    
    // 🔥 بعد أول fetch، نعتبر initialized
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
    }
  }, [processingOrders, soundEnabled, onOpenSidebar]);

  // Poll for new orders every 60 seconds
  useEffect(() => {
    fetchProcessingOrders();
    const interval = setInterval(fetchProcessingOrders, 60000); // 🔥 60 ثانية بدل 30
    return () => clearInterval(interval);
  }, [soundEnabled]);

  return (
    <button
      onClick={onToggleSidebar}
      className="relative p-2 hover:bg-gray-100 rounded-full transition-all hover:scale-110"
    >
      <span className="text-2xl animate-ring">🔔</span>
      {notificationCount > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce shadow-lg">
          {notificationCount}
        </span>
      )}
    </button>
  );
}
