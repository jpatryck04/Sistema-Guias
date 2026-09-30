'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { Formulario } from '@/types/formulario';
import type { ItemImpresion, ProgresoImpresion } from '@/types/impresion';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  formularios: Formulario[];
  onConfirm: (items: ItemImpresion[]) => Promise<boolean>;
  imprimiendo: boolean;
  progreso: ProgresoImpresion | null;
}

export function ModalImpresion({
  open,
  onOpenChange,
  formularios,
  onConfirm,
  imprimiendo,
  progreso,
}: Props) {
  const [copias, setCopias] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    formularios.forEach((f) => (next[f.id] = 1));
    // Esta sincronización es necesaria para inicializar el estado cuando cambia la
    // lista de formularios del modal. El valor se deriva de props externas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopias(next);
  }, [formularios]);

  const handleChange = (id: string, val: string) => {
    const num = Number(val);
    if (Number.isNaN(num)) return;
    const clamped = Math.min(20, Math.max(1, num));
    setCopias((prev) => ({ ...prev, [id]: clamped }));
  };

  async function handleConfirm() {
    const items: ItemImpresion[] = formularios.map((f) => ({
      formularioId: f.id,
      formularioNombre: f.nombre,
      storagePath: f.storage_path,
      copias: copias[f.id] ?? 1,
    }));

    onOpenChange(false);
    await onConfirm(items);
  }

  const totalCopias = Object.values(copias).reduce((a, b) => a + b, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar impresión</DialogTitle>
        </DialogHeader>

        {imprimiendo && progreso ? (
          <div className="space-y-3 py-4">
            <p className="text-sm font-medium">
              Imprimiendo {progreso.actual} de {progreso.total}...
            </p>
            <Progress value={(progreso.actual / progreso.total) * 100} />
            <p className="text-sm font-semibold text-foreground">{progreso.formularioNombre}</p>
            <p className="text-xs text-muted-foreground">
              Esperando confirmación del navegador. Cuando cierres el diálogo de impresión, se
              continuará con el siguiente formulario.
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto py-2">
              {formularios.map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <div className="flex-1 truncate text-sm">{f.nombre}</div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Copias</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={copias[f.id] ?? 1}
                      onChange={(e) => handleChange(f.id, e.target.value)}
                      className="w-20"
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-sm text-muted-foreground">Total de copias: {totalCopias}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirm}>Confirmar e imprimir</Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}