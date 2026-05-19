"use client";

import { useEffect, useState } from "react";
import { SubscribeModal } from "@/components/wallet/SubscribeModal";

interface Props {
  autoOpen?: boolean;
  inlineButton?: boolean;
}

export function SubscribeLauncher({ autoOpen = false, inlineButton = false }: Props) {
  const [open, setOpen] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <>
      {inlineButton && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary whitespace-nowrap"
        >
          Subscribe · 0.1 SOL
        </button>
      )}
      <SubscribeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
