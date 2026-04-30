import { headers } from 'next/headers';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Streamlabs Desktop accepts the same Scene Collection JSON format as OBS Studio
 * (it's a fork of OBS). Same payload, different filename hint for clarity.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) return new Response('Not found', { status: 404 });

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const telaoUrl = `${proto}://${host}/telao/${event.slug}?mode=browser_source`;

  const scene = {
    DesktopAudioDevice1: { hotkeys: {} },
    current_program_scene: `Audience — ${event.name}`,
    current_scene: `Audience — ${event.name}`,
    current_transition: 'Fade',
    groups: [],
    modules: {},
    name: `Audience — ${event.name}`,
    quick_transitions: [],
    saved_projectors: [],
    scene_order: [{ name: `Audience — ${event.name}` }],
    sources: [
      {
        balance: 0.5,
        deinterlace_field_order: 0,
        deinterlace_mode: 0,
        enabled: true,
        flags: 0,
        hotkeys: {},
        id: 'browser_source',
        mixers: 0,
        monitoring_type: 0,
        muted: false,
        name: 'Audience Comentários',
        prev_ver: 503316482,
        private_settings: {},
        push_to_mute: false,
        push_to_mute_delay: 0,
        push_to_talk: false,
        push_to_talk_delay: 0,
        settings: {
          url: telaoUrl,
          width: 1920,
          height: 1080,
          fps: 30,
          fps_custom: false,
          shutdown: false,
          restart_when_active: false,
          reroute_audio: false,
          css: 'body { background: transparent !important; margin: 0; }',
        },
        sync: 0,
        versioned_id: 'browser_source',
        volume: 1.0,
      },
      {
        balance: 0.5,
        deinterlace_field_order: 0,
        deinterlace_mode: 0,
        enabled: true,
        flags: 0,
        hotkeys: {},
        id: 'scene',
        mixers: 0,
        monitoring_type: 0,
        muted: false,
        name: `Audience — ${event.name}`,
        prev_ver: 503316482,
        private_settings: {},
        push_to_mute: false,
        push_to_mute_delay: 0,
        push_to_talk: false,
        push_to_talk_delay: 0,
        settings: {
          custom_size: false,
          id_counter: 1,
          items: [
            {
              align: 5,
              bounds: { x: 0, y: 0 },
              bounds_align: 0,
              bounds_type: 0,
              crop_bottom: 0,
              crop_left: 0,
              crop_right: 0,
              crop_top: 0,
              group_item_backup: false,
              hide_transition: { duration: 0 },
              id: 1,
              locked: false,
              name: 'Audience Comentários',
              pos: { x: 0, y: 0 },
              private_settings: {},
              rot: 0.0,
              scale: { x: 1.0, y: 1.0 },
              scale_filter: 'disable',
              show_transition: { duration: 0 },
              visible: true,
            },
          ],
        },
        sync: 0,
        versioned_id: 'scene',
        volume: 1.0,
      },
    ],
    transition_duration: 300,
    transitions: [],
  };

  return new Response(JSON.stringify(scene, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audience-${event.slug}-streamlabs.json"`,
    },
  });
}
