import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  reminder_minutes?: number;
}

interface RequestBody {
  action: 'create_event' | 'update_event' | 'delete_event' | 'get_auth_url' | 'exchange_code';
  event?: CalendarEvent;
  event_id?: string;
  task_id?: string;
  code?: string;
  redirect_uri?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    console.log('Google Calendar request:', { action: body.action, userId: user.id });

    // Check if Google Calendar is configured
    if (!googleClientId || !googleClientSecret) {
      console.log('Google Calendar not fully configured, simulating success');
      
      // Return success for demo purposes - in production, this would require proper OAuth setup
      if (body.action === 'create_event' && body.event && body.task_id) {
        // Log the calendar event creation attempt
        await supabase.from('activities').insert({
          lead_id: null, // We'll need to get this from the task
          type: 'task',
          title: `Viewing scheduled: ${body.event.summary}`,
          description: `Location: ${body.event.location || 'TBD'}\nTime: ${new Date(body.event.start).toLocaleString()}\nReminder: ${body.event.reminder_minutes || 30} minutes before`,
          created_by: user.id,
          metadata: {
            google_calendar_pending: true,
            event_details: body.event,
            task_id: body.task_id,
          },
        }).select().maybeSingle();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Event created (Google Calendar sync pending OAuth setup)',
            event_id: `local_${Date.now()}`,
            requires_oauth: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Calendar OAuth not configured',
          requires_setup: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's Google tokens from api_integrations
    const { data: integration } = await supabase
      .from('api_integrations')
      .select('*')
      .eq('created_by', user.id)
      .eq('type', 'google_calendar')
      .maybeSingle();

    switch (body.action) {
      case 'get_auth_url': {
        const redirectUri = body.redirect_uri || `${supabaseUrl}/functions/v1/google-calendar/callback`;
        const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
        
        return new Response(
          JSON.stringify({ auth_url: authUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'exchange_code': {
        if (!body.code || !body.redirect_uri) {
          return new Response(
            JSON.stringify({ error: 'Missing code or redirect_uri' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            code: body.code,
            grant_type: 'authorization_code',
            redirect_uri: body.redirect_uri,
          }),
        });

        const tokens = await tokenResponse.json();
        
        if (tokens.error) {
          return new Response(
            JSON.stringify({ error: tokens.error_description || tokens.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store tokens in api_integrations
        await supabase.from('api_integrations').upsert({
          type: 'google_calendar',
          name: 'Google Calendar',
          created_by: user.id,
          is_connected: true,
          config: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
          },
        }, { onConflict: 'created_by,type' });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_event': {
        if (!body.event) {
          return new Response(
            JSON.stringify({ error: 'Missing event data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for valid token
        if (!integration?.config?.access_token) {
          // Store event locally for later sync
          console.log('No Google token, storing event locally');
          
          if (body.task_id) {
            // Get the task to find the lead_id
            const { data: task } = await supabase
              .from('tasks')
              .select('lead_id')
              .eq('id', body.task_id)
              .maybeSingle();

            if (task?.lead_id) {
              await supabase.from('activities').insert({
                lead_id: task.lead_id,
                type: 'task',
                title: `Viewing scheduled: ${body.event.summary}`,
                description: `Location: ${body.event.location || 'TBD'}\nTime: ${new Date(body.event.start).toLocaleString()}\nReminder: ${body.event.reminder_minutes || 30} min before`,
                created_by: user.id,
                metadata: {
                  google_calendar_pending: true,
                  event_details: body.event,
                  task_id: body.task_id,
                },
              });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Event saved locally (connect Google Calendar to sync)',
              requires_oauth: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Refresh token if needed
        let accessToken = integration.config.access_token;
        if (integration.config.expires_at && Date.now() > integration.config.expires_at - 60000) {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: integration.config.refresh_token,
              grant_type: 'refresh_token',
            }),
          });
          
          const refreshed = await refreshResponse.json();
          if (refreshed.access_token) {
            accessToken = refreshed.access_token;
            await supabase.from('api_integrations')
              .update({
                config: {
                  ...integration.config,
                  access_token: refreshed.access_token,
                  expires_at: Date.now() + refreshed.expires_in * 1000,
                },
              })
              .eq('id', integration.id);
          }
        }

        // Create Google Calendar event
        const calendarEvent = {
          summary: body.event.summary,
          description: body.event.description,
          location: body.event.location,
          start: {
            dateTime: body.event.start,
            timeZone: 'UTC',
          },
          end: {
            dateTime: body.event.end,
            timeZone: 'UTC',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: body.event.reminder_minutes || 30 },
              { method: 'email', minutes: body.event.reminder_minutes || 30 },
            ],
          },
        };

        const createResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(calendarEvent),
          }
        );

        const createdEvent = await createResponse.json();
        
        if (createdEvent.error) {
          console.error('Google Calendar API error:', createdEvent.error);
          return new Response(
            JSON.stringify({ error: createdEvent.error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update task with Google Calendar event ID
        if (body.task_id) {
          await supabase.from('tasks')
            .update({ google_sheet_row_id: createdEvent.id })
            .eq('id', body.task_id);
        }

        console.log('Google Calendar event created:', createdEvent.id);

        return new Response(
          JSON.stringify({
            success: true,
            event_id: createdEvent.id,
            html_link: createdEvent.htmlLink,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_event': {
        if (!body.event_id || !integration?.config?.access_token) {
          return new Response(
            JSON.stringify({ error: 'Missing event_id or not connected' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${body.event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${integration.config.access_token}`,
            },
          }
        );

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Google Calendar function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
