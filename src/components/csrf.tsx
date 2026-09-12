import { CAMPO_CSRF } from '@/lib/csrf';

/** Campo escondido exigido por toda server action que altera dados. */
export function CampoCsrf({ token }: { token: string }) {
  return <input type="hidden" name={CAMPO_CSRF} value={token} />;
}
