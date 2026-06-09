
ALTER TABLE public.itens_venda ALTER COLUMN produto_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.aplicar_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.produto_id is null then
    return new;
  end if;
  update public.produtos set estoque = estoque - new.quantidade where id = new.produto_id;
  insert into public.movimentacoes_estoque(produto_id, tipo, quantidade, observacao, user_id, venda_id)
  values (new.produto_id, 'saida_venda', new.quantidade, 'Venda automática', auth.uid(), new.venda_id);
  return new;
end;
$function$;
