import { supabase } from "../../../../lib/supabaseClient";

export class NotificationService {
  static async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  }

  static async getNotifications(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  static async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }

  static async createNotification(notification) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert([
          {
            ...notification,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  }

  static async deleteNotification(notificationId) {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }

  static async clearAll(userId) {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error clearing notifications:", error);
      return false;
    }
  }

  static subscribeToNotifications(userId, callback) {
    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback("new", payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback("update", payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Batch create notifications
  static async createBatchNotifications(notifications) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert(
          notifications.map((n) => ({
            ...n,
            created_at: new Date().toISOString(),
          }))
        )
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error creating batch notifications:", error);
      return [];
    }
  }

  // Get notifications with pagination
  static async getNotificationsPaginated(userId, page = 1, pageSize = 10) {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    } catch (error) {
      console.error("Error fetching paginated notifications:", error);
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }
}
