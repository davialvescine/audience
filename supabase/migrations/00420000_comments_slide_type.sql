-- 00420000_comments_slide_type.sql
-- Novo tipo de slide "comments" (Cards rotativos): mostra cards de comentários
-- aprovados pelo moderador, um por vez, com toda parametrização visual (fonte,
-- cor, posição, animação, duração) controlada pelo painel lateral do slide.
-- Reaproveita o renderer TelaoClient existente.

alter type public.slide_type add value if not exists 'comments';
