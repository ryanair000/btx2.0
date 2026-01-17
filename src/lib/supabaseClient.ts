import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase URL or anon key");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SavedPrediction {
  id?: string;
  match_id: string;
  match_name: string;
  predicted_winner: string;
  confidence: number;
  predicted_accuracy: number;
  summary_insight: string;
  key_factors: string[];
  accuracy_reason: string;
  created_at?: string;
}

// Save a prediction to the database
export async function savePrediction(
  prediction: Omit<SavedPrediction, "id" | "created_at">
): Promise<SavedPrediction | null> {
  try {
    const { data, error } = await supabase
      .from("predictions")
      .insert([prediction])
      .select()
      .single();

    if (error) {
      console.error("Error saving prediction:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to save prediction:", error);
    return null;
  }
}

// Get all saved predictions
export async function getPredictions(): Promise<SavedPrediction[]> {
  try {
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching predictions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch predictions:", error);
    return [];
  }
}

// Get recent predictions (last N records)
export async function getRecentPredictions(limit: number = 5): Promise<SavedPrediction[]> {
  try {
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent predictions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch recent predictions:", error);
    return [];
  }
}

// Delete a prediction
export async function deletePrediction(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("predictions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting prediction:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete prediction:", error);
    return false;
  }
}

// Check if table exists and create if needed
export async function initializeDatabase(): Promise<void> {
  try {
    // Try to query the table - if it doesn't exist, the error will tell us
    const { data, error } = await supabase.from("predictions").select("id").limit(1);

    if (error && error.code === "PGRST116") {
      console.warn(
        "Predictions table does not exist. Please create it in Supabase dashboard."
      );
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}
