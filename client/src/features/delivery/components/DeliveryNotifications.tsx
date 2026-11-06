import { useCallback, useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { apiRequest } from "../../../lib/api";

interface DeliveryNotification {
  _id: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

interface NotificationResponse {
  success: boolean;
  data: { notifications: DeliveryNotification[] };
}

export default function DeliveryNotifications() {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiRequest<NotificationResponse>("/notifications");
      setNotifications(response.data.notifications || []);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load notifications.");
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadNotifications(), 0);
    const timer = window.setInterval(() => void loadNotifications(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadNotifications]);

  const markRead = async (notificationId: string) => {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" });
      setNotifications((current) =>
        current.map((item) => item._id === notificationId
          ? { ...item, readAt: new Date().toISOString() }
          : item
        )
      );
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update notification.");
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,90vw)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={15} /></button>
          </div>
          {error && <p className="px-4 py-2 text-xs text-red-700">{error}</p>}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? notifications.map((notification) => (
              <article key={notification._id} className={`border-b border-slate-100 px-4 py-3 ${notification.readAt ? "bg-white" : "bg-blue-50/60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{notification.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                    <time className="mt-1 block text-[10px] text-slate-400">
                      {Number.isNaN(new Date(notification.createdAt).getTime())
                        ? "Date unavailable"
                        : new Date(notification.createdAt).toLocaleString()}
                    </time>
                  </div>
                  {!notification.readAt && (
                    <button type="button" aria-label="Mark as read" onClick={() => void markRead(notification._id)} className="rounded p-1 text-blue-700 hover:bg-blue-100"><Check size={15} /></button>
                  )}
                </div>
              </article>
            )) : (
              <p className="px-4 py-8 text-center text-xs text-slate-400">No notifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
