import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const WHATSAPP_BUSINESS_TOKEN = Deno.env.get("WHATSAPP_BUSINESS_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Handle webhook verification (GET request from Meta)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
        console.log("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // Handle incoming messages (POST request)
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received webhook:", JSON.stringify(body, null, 2));

      // Extract message data from WhatsApp webhook format
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        // This might be a status update, not a message
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const message = messages[0];
      const phoneNumber = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;

      // Determine message type and content
      let messageContent = "";
      let messageType = "text";
      let audioUrl = "";

      if (message.type === "text") {
        messageContent = message.text?.body || "";
        messageType = "text";
      } else if (message.type === "audio") {
        // Voice message - need to download and transcribe
        messageType = "voice";
        const audioId = message.audio?.id;
        
        if (audioId && WHATSAPP_BUSINESS_TOKEN) {
          // Get the audio URL from WhatsApp
          const mediaResponse = await fetch(
            `https://graph.facebook.com/v18.0/${audioId}`,
            {
              headers: { Authorization: `Bearer ${WHATSAPP_BUSINESS_TOKEN}` },
            }
          );
          const mediaData = await mediaResponse.json();
          audioUrl = mediaData.url || "";

          // Download and transcribe the audio
          if (audioUrl) {
            const audioResponse = await fetch(audioUrl, {
              headers: { Authorization: `Bearer ${WHATSAPP_BUSINESS_TOKEN}` },
            });
            const audioBuffer = await audioResponse.arrayBuffer();

            // Transcribe with ElevenLabs
            const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
            if (ELEVENLABS_API_KEY) {
              const formData = new FormData();
              formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
              formData.append("model_id", "scribe_v2");

              const transcriptionResponse = await fetch(
                "https://api.elevenlabs.io/v1/speech-to-text",
                {
                  method: "POST",
                  headers: { "xi-api-key": ELEVENLABS_API_KEY },
                  body: formData,
                }
              );

              if (transcriptionResponse.ok) {
                const transcriptionData = await transcriptionResponse.json();
                messageContent = transcriptionData.text || "";
              }
            }
          }
        }
      }

      if (!messageContent) {
        console.log("No processable content in message");
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call the WhatsApp agent function to process the message
      const agentResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/whatsapp-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            phoneNumber,
            messageContent,
            messageType,
            audioUrl,
            messageId,
            timestamp,
          }),
        }
      );

      const agentResult = await agentResponse.json();
      console.log("Agent response:", agentResult);

      return new Response(JSON.stringify({ status: "ok", result: agentResult }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
