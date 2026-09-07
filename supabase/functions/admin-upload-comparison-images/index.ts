import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return j({ success: false, error: 'auth' });
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!userData?.user) return j({ success: false, error: 'auth' });

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) return j({ success: false, error: 'forbidden' });

    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) return j({ success: false, error: 'no_images' });

    const rows = images
      .filter((i: any) => i?.category_slug && i?.image_url)
      .map((i: any) => ({
        category_slug: i.category_slug,
        image_url: i.image_url,
        source_prompt: i.source_prompt ?? null,
        provider: i.provider ?? 'civitai',
      }));

    const { error, count } = await supabase
      .from('comparison_images')
      .insert(rows, { count: 'exact' });
    if (error) return j({ success: false, error: error.message });

    return j({ success: true, inserted: count ?? rows.length });
  } catch (e) {
    console.error(e);
    return j({ success: false, error: 'internal' });
  }
});

function j(o: unknown) {
  return new Response(JSON.stringify(o), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
