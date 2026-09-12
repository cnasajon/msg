/** Faixas de erro e de confirmação vindas da URL (`?erro=` / `?ok=`). */
export function Avisos({ erro, ok }: { erro?: string; ok?: string }) {
  if (!erro && !ok) return null;
  return (
    <>
      {erro ? (
        <div className="banner err">
          <div>{erro}</div>
        </div>
      ) : null}
      {ok ? (
        <div className="banner ok">
          <div>{ok}</div>
        </div>
      ) : null}
    </>
  );
}
