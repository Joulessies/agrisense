import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      const adminClient = createAdminClient();
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: cleanName,
          role: "farmer",
        },
      });

      if (authError) {
        if (
          authError.message?.toLowerCase().includes("already registered") ||
          authError.message?.toLowerCase().includes("already exists")
        ) {
          return NextResponse.json(
            { error: "This email is already registered. Please sign in." },
            { status: 400 }
          );
        }

        const { data: fallbackData, error: fallbackError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { name: cleanName, role: "farmer" },
          },
        });

        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          user: fallbackData.user,
        });
      }

      if (authData.user) {
        const { error: profileError } = await adminClient.from("profiles").upsert(
          {
            id: authData.user.id,
            name: cleanName,
            email: cleanEmail,
            role: "farmer",
            status: "active",
          },
          { onConflict: "id" }
        );

        if (profileError) {
          console.warn("[Register] Profile table write warning:", profileError.message);
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        await adminClient.from("activity_logs").insert([
          {
            time: timeStr,
            text: `New user registered: ${cleanName} (${cleanEmail})`,
            tone: "info",
          },
        ]);

        return NextResponse.json({
          success: true,
          user: authData.user,
        });
      }
    } catch (adminErr: any) {
      const { data: fallbackData, error: fallbackError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name: cleanName, role: "farmer" },
        },
      });

      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        user: fallbackData.user,
      });
    }

    return NextResponse.json(
      { error: "Failed to create user account." },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
