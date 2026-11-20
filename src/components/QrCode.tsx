import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QR code em SVG a partir de um texto (o código Pix copia e cola). Montado com elementos React a partir dos
 * módulos da biblioteca, sem injetar HTML. Quem não consegue ver a imagem usa o código copia e cola ao lado.
 */
export function QrCode({ texto, rotulo }: { texto: string; rotulo: string }) {
  const caminho = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let linha = 0; linha < n; linha++) {
      for (let coluna = 0; coluna < n; coluna++) {
        if (qr.isDark(linha, coluna)) d += `M${coluna} ${linha}h1v1h-1z`;
      }
    }
    return { d, n };
  }, [texto]);

  const margem = 4; // zona silenciosa exigida pelo padrão do QR
  const lado = caminho.n + margem * 2;
  return (
    <svg viewBox={`0 0 ${lado} ${lado}`} role="img" aria-label={rotulo} width="220" height="220" shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 12 }}>
      <path d={caminho.d} transform={`translate(${margem} ${margem})`} fill="#0c0d10" />
    </svg>
  );
}
