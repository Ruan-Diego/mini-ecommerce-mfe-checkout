import { Navigate, Route, Routes } from 'react-router-dom';
import type { PropsRemoto } from '@ruan-diego/mini-event-contracts';
import { Endereco } from './pages/Endereco';
import { Frete } from './pages/Frete';
import { Pagamento } from './pages/Pagamento';
import { Pix } from './pages/Pix';
import { Confirmado } from './pages/Confirmado';

/**
 * Módulo exposto como ./App. O shell monta este componente numa rota com "/*",
 * então as rotas abaixo são relativas a props.basePath.
 */
export default function App(_props: PropsRemoto) {
  return (
    <Routes>
      <Route index element={<Navigate to="endereco" replace />} />
      <Route path="endereco" element={<Endereco />} />
      <Route path="frete" element={<Frete />} />
      <Route path="pagamento" element={<Pagamento />} />
      <Route path="pix/:pedidoId" element={<Pix />} />
      <Route path="confirmado/:pedidoId" element={<Confirmado />} />
      <Route path="*" element={<p className="wrap muted">Página não encontrada neste microfrontend.</p>} />
    </Routes>
  );
}
