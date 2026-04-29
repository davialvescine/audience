-- seed.sql
insert into public.themes (slug, name, tokens) values (
  'geracao-2026',
  'Geração 2026 — O Nascer de Uma Geração',
  jsonb_build_object(
    'colors', jsonb_build_object(
      'primary', '14 76 94',
      'primaryDeep', '10 44 61',
      'accent', '245 197 24',
      'secondary', '110 69 182',
      'ink', '10 37 64',
      'paper', '255 255 255',
      'surface', '248 250 252',
      'success', '16 185 129',
      'danger', '239 68 68'
    ),
    'radius', jsonb_build_object('sm', '0.375rem', 'md', '0.75rem', 'lg', '1.25rem'),
    'font', jsonb_build_object(
      'sans', 'Inter, ui-sans-serif, system-ui, sans-serif',
      'display', 'Inter, ui-sans-serif, system-ui, sans-serif'
    )
  )
)
on conflict (slug) do update set tokens = excluded.tokens, name = excluded.name;
