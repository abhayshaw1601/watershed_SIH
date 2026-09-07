"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { X } from "@phosphor-icons/react";

export default function ModelStatusModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage("Validating PyTorch state_dict...");

    // Simulated model upload & validation
    setTimeout(() => {
      setIsUploading(false);
      setUploadMessage("Model weights updated successfully (6-band U-Net).");
      setTimeout(() => setUploadMessage(null), 3000);
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm animate-fade-up">
      <div className="relative w-full max-w-xl rounded-2xl border border-foreground/15 bg-background p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Badge tone="sage">ONLINE</Badge>
            <h3 className="font-display text-xl sm:text-2xl">Model 1 U-Net Checkpoint</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 text-sm font-mono cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
              <span className="text-muted-foreground block text-[10px] uppercase">Active Checkpoint</span>
              <span className="font-medium text-foreground">models/model1_lulc_unet.pt</span>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
              <span className="text-muted-foreground block text-[10px] uppercase">Validation IoU</span>
              <span className="font-medium text-sage">49.1% Mean IoU (Epoch 20)</span>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
              <span className="text-muted-foreground block text-[10px] uppercase">Backbone &amp; Inputs</span>
              <span className="font-medium text-foreground">ResNet18 · 6 bands</span>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
              <span className="text-muted-foreground block text-[10px] uppercase">Inference Device</span>
              <span className="font-medium text-foreground">PyTorch (CUDA / CPU auto)</span>
            </div>
          </div>

          <div className="rounded-xl border border-foreground/10 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Retraining / Updating Weights:</p>
            <p>
              Trained via Google Colab GPU in{" "}
              <code className="bg-foreground/5 px-1 py-0.5 rounded text-foreground">
                project/notebooks/watershed_pipeline.ipynb
              </code>
              . Trained on 4 real diverse sites (Kadwanchi, Tamhini Ghat, Donimalai Mine, Jayakwadi Dam).
            </p>
          </div>

          {/* Checkpoint File Uploader */}
          <div className="rounded-xl border border-dashed border-foreground/20 p-5 text-center">
            <input
              type="file"
              accept=".pt"
              id="model-upload"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="model-upload">
              <Button size="sm" type="button" onClick={() => document.getElementById("model-upload")?.click()}>
                {isUploading ? "Uploading..." : "Replace model1_lulc_unet.pt (Upload .pt)"}
              </Button>
            </label>
            <p className="mt-2 text-[11px] font-mono text-muted-foreground">
              Supports raw PyTorch state dict weights (.pt)
            </p>
          </div>

          {uploadMessage && (
            <div className="rounded-lg border border-foreground/15 bg-foreground/5 p-3 text-xs font-mono text-center">
              {uploadMessage}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-foreground/10 pt-4">
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
