import { Casca } from './casca';
import type { SessaoAtual } from '@/lib/sessao';

/** Telas das fases 2 a 4. Existe para a navegação não terminar em 404. */
export function EmConstrucao({
  sessao,
  titulo,
  caminho,
  atual,
  fase,
  descricao,
}: {
  sessao: SessaoAtual;
  titulo: string;
  caminho: string;
  atual: string;
  fase: number;
  descricao: string;
}) {
  return (
    <Casca sessao={sessao} titulo={titulo} caminho={caminho} atual={atual}>
      <div className="banner info">
        <div>
          <div className="ttl">Chega na fase {fase}</div>
          {descricao}
        </div>
      </div>
    </Casca>
  );
}
