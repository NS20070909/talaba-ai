import { getSupabase } from "./supabase";
import { bot } from "./bot";

export type TicketCategory =
  | "PAYMENT"
  | "PREMIUM"
  | "AI_PROBLEMS"
  | "TECHNICAL"
  | "BUG_REPORT"
  | "SUGGESTION"
  | "OTHER";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED";

export interface SupportTicket {
  id: string;
  ticket_number: number;
  telegram_id: number;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string | null;
  assigned_admin_id: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: "USER" | "ADMIN" | "SYSTEM";
  sender_id: number;
  message_text: string;
  telegram_file_id: string | null;
  telegram_file_type: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  PAYMENT: "💳 Payment",
  PREMIUM: "⭐ Premium",
  AI_PROBLEMS: "🤖 AI Problems",
  TECHNICAL: "⚙ Technical Problem",
  BUG_REPORT: "🐞 Bug Report",
  SUGGESTION: "💡 Suggestion",
  OTHER: "📦 Other",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "🟢 Low",
  MEDIUM: "🟡 Medium",
  HIGH: "🟠 High",
  URGENT: "🔴 Urgent",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "📬 Open",
  IN_PROGRESS: "⏳ In Progress",
  WAITING_USER: "⌛ Waiting User",
  RESOLVED: "✅ Resolved",
  CLOSED: "🔒 Closed",
};

// ─────────────────────────────────────────────────────────────────────────────
// TICKET CREATION & MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

export async function createTicket(data: {
  telegram_id: number;
  category: TicketCategory;
  message_text: string;
  priority?: TicketPriority;
  telegram_file_id?: string;
  telegram_file_type?: string;
}): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const priority = data.priority || "MEDIUM";

  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .insert({
      telegram_id: data.telegram_id,
      category: data.category,
      priority: priority,
      status: "OPEN",
      subject: data.message_text.slice(0, 100),
      last_activity_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (ticketErr) {
    console.error("createTicket error:", ticketErr);
    throw ticketErr;
  }

  const { data: message, error: msgErr } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_type: "USER",
      sender_id: data.telegram_id,
      message_text: data.message_text,
      telegram_file_id: data.telegram_file_id || null,
      telegram_file_type: data.telegram_file_type || null,
      created_at: now,
    })
    .select("*")
    .single();

  if (msgErr) {
    console.error("createTicket message error:", msgErr);
    throw msgErr;
  }

  return { ticket, message };
}

export async function addMessageToTicket(data: {
  ticket_id: string;
  sender_id: number;
  sender_type: "USER" | "ADMIN" | "SYSTEM";
  message_text: string;
  telegram_file_id?: string;
  telegram_file_type?: string;
}): Promise<SupportMessage> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: message, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: data.ticket_id,
      sender_type: data.sender_type,
      sender_id: data.sender_id,
      message_text: data.message_text,
      telegram_file_id: data.telegram_file_id || null,
      telegram_file_type: data.telegram_file_type || null,
      created_at: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("addMessageToTicket error:", error);
    throw error;
  }

  const ticketUpdates: any = {
    last_activity_at: now,
    updated_at: now,
  };

  if (data.sender_type === "ADMIN") {
    ticketUpdates.status = "WAITING_USER";
    const ticket = await getTicketById(data.ticket_id);
    if (ticket && !ticket.first_response_at) {
      ticketUpdates.first_response_at = now;
      ticketUpdates.assigned_admin_id = data.sender_id;
    }
  } else if (data.sender_type === "USER") {
    ticketUpdates.status = "IN_PROGRESS";
  }

  await supabase.from("support_tickets").update(ticketUpdates).eq("id", data.ticket_id);

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ & QUERY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTicketById(id: string): Promise<SupportTicket | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getTicketByNumber(number: number): Promise<SupportTicket | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("ticket_number", number)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUserTickets(telegramId: number): Promise<SupportTicket[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code !== "PGRST205") console.error("getUserTickets error:", error);
    return [];
  }
  return data || [];
}

export async function getAdminTickets(statusFilter?: TicketStatus): Promise<SupportTicket[]> {
  const supabase = getSupabase();
  let query = supabase.from("support_tickets").select("*");

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.order("last_activity_at", { ascending: false }).limit(50);

  if (error) {
    if (error.code !== "PGRST205") console.error("getAdminTickets error:", error);
    return [];
  }
  return data || [];
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getTicketMessages error:", error);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS & PRIORITY
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<SupportTicket | null> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const updates: any = { status, updated_at: now, last_activity_at: now };

  if (status === "RESOLVED") {
    updates.resolved_at = now;
  } else if (status === "CLOSED") {
    updates.closed_at = now;
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error) {
    console.error("updateTicketStatus error:", error);
    throw error;
  }
  return data;
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority
): Promise<SupportTicket | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_tickets")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error) {
    console.error("updateTicketPriority error:", error);
    throw error;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH, STATISTICS & AUTO CLOSE
// ─────────────────────────────────────────────────────────────────────────────

export async function searchTickets(query: string): Promise<SupportTicket[]> {
  const supabase = getSupabase();
  const clean = query.trim();

  if (!clean) return [];

  // Search by Ticket Number
  const num = Number(clean.replace("#", ""));
  if (!isNaN(num) && num > 0) {
    const { data } = await supabase.from("support_tickets").select("*").eq("ticket_number", num);
    if (data && data.length > 0) return data;
  }

  // Search by numeric Telegram ID
  const telegramId = Number(clean);
  if (!isNaN(telegramId) && telegramId > 0) {
    const { data } = await supabase.from("support_tickets").select("*").eq("telegram_id", telegramId);
    if (data && data.length > 0) return data;
  }

  // Search by category, priority, or status
  const upper = clean.toUpperCase();
  if (["PAYMENT", "PREMIUM", "AI_PROBLEMS", "TECHNICAL", "BUG_REPORT", "SUGGESTION", "OTHER"].includes(upper)) {
    const { data } = await supabase.from("support_tickets").select("*").eq("category", upper);
    if (data) return data;
  }
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(upper)) {
    const { data } = await supabase.from("support_tickets").select("*").eq("priority", upper);
    if (data) return data;
  }
  if (["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"].includes(upper)) {
    const { data } = await supabase.from("support_tickets").select("*").eq("status", upper);
    if (data) return data;
  }

  // Search by user name or username
  const { data: users } = await supabase
    .from("users")
    .select("telegram_id")
    .or(`first_name.ilike.%${clean}%,username.ilike.%${clean}%`);

  if (users && users.length > 0) {
    const ids = users.map((u) => u.telegram_id);
    const { data } = await supabase.from("support_tickets").select("*").in("telegram_id", ids);
    if (data) return data;
  }

  return [];
}

export async function getSupportStats(): Promise<{
  total_tickets: number;
  open: number;
  in_progress: number;
  waiting_user: number;
  resolved: number;
  closed: number;
  avg_response_minutes: number;
  avg_resolution_hours: number;
  category_counts: Record<string, number>;
}> {
  const supabase = getSupabase();
  const { data: tickets } = await supabase.from("support_tickets").select("*");

  if (!tickets || tickets.length === 0) {
    return {
      total_tickets: 0,
      open: 0,
      in_progress: 0,
      waiting_user: 0,
      resolved: 0,
      closed: 0,
      avg_response_minutes: 0,
      avg_resolution_hours: 0,
      category_counts: {},
    };
  }

  let open = 0, in_progress = 0, waiting_user = 0, resolved = 0, closed = 0;
  let totalResponseMs = 0, responseCount = 0;
  let totalResolutionMs = 0, resolutionCount = 0;

  const category_counts: Record<string, number> = {};

  tickets.forEach((t) => {
    category_counts[t.category] = (category_counts[t.category] || 0) + 1;

    if (t.status === "OPEN") open++;
    else if (t.status === "IN_PROGRESS") in_progress++;
    else if (t.status === "WAITING_USER") waiting_user++;
    else if (t.status === "RESOLVED") resolved++;
    else if (t.status === "CLOSED") closed++;

    if (t.first_response_at && t.created_at) {
      totalResponseMs += new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime();
      responseCount++;
    }

    if (t.resolved_at && t.created_at) {
      totalResolutionMs += new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      resolutionCount++;
    }
  });

  return {
    total_tickets: tickets.length,
    open,
    in_progress,
    waiting_user,
    resolved,
    closed,
    avg_response_minutes: responseCount > 0 ? Math.round(totalResponseMs / (responseCount * 60000)) : 0,
    avg_resolution_hours: resolutionCount > 0 ? Math.round((totalResolutionMs / (resolutionCount * 3600000)) * 10) / 10 : 0,
    category_counts,
  };
}

export async function autoCloseResolvedTickets(): Promise<SupportTicket[]> {
  const supabase = getSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: ticketsToClose } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("status", "RESOLVED")
    .lt("last_activity_at", sevenDaysAgo);

  if (!ticketsToClose || ticketsToClose.length === 0) return [];

  const ids = ticketsToClose.map((t) => t.id);
  const now = new Date().toISOString();

  await supabase
    .from("support_tickets")
    .update({ status: "CLOSED", closed_at: now, updated_at: now })
    .in("id", ids);

  return ticketsToClose.map((t) => ({ ...t, status: "CLOSED" as TicketStatus }));
}
