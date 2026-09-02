"""
Model 1 — LULC U-Net (model_plan.md section 2).
ResNet18 encoder (ImageNet weights), 6-channel input, 7-class output.
Tuned for 4GB VRAM: small batch, mixed precision, frozen encoder for first N epochs.

Run:  .venv/Scripts/python.exe src/model1_unet.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import torch
from torch.utils.data import DataLoader
import segmentation_models_pytorch as smp

from config import BATCH_SIZE, CLASS_NAMES, IN_CHANNELS, LR, MODELS_DIR, NUM_CLASSES, NUM_EPOCHS, OUTPUTS_DIR
from dataset import WatershedTileDataset
from evaluate import evaluate_model, metrics_from_confusion, plot_confusion_matrix, print_metrics_report

FREEZE_ENCODER_EPOCHS = 5


def build_model():
    model = smp.Unet(
        encoder_name="resnet18",
        encoder_weights="imagenet",
        in_channels=IN_CHANNELS,
        classes=NUM_CLASSES,
    )
    return model


def set_encoder_trainable(model, trainable: bool):
    for p in model.encoder.parameters():
        p.requires_grad = trainable


def run_epoch(model, loader, loss_fn, optimizer, scaler, device, train: bool):
    model.train(train)
    total_loss, n_batches = 0.0, 0
    for images, masks in loader:
        images, masks = images.to(device), masks.to(device)
        with torch.set_grad_enabled(train):
            with torch.autocast(device_type=device.type, enabled=(device.type == "cuda")):
                logits = model(images)
                loss = loss_fn(logits, masks)
            if train:
                optimizer.zero_grad(set_to_none=True)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
        total_loss += loss.item()
        n_batches += 1
    return total_loss / max(n_batches, 1)


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}" + (f" ({torch.cuda.get_device_name(0)})" if device.type == "cuda" else ""))

    train_ds = WatershedTileDataset("train")
    val_ds = WatershedTileDataset("val")
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    print(f"Train tiles: {len(train_ds)}  Val tiles: {len(val_ds)}")

    model = build_model().to(device)
    set_encoder_trainable(model, False)

    dice = smp.losses.DiceLoss(mode="multiclass")
    ce = torch.nn.CrossEntropyLoss()
    loss_fn = lambda logits, target: dice(logits, target) + ce(logits, target)

    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))

    best_val = float("inf")
    ckpt_path = MODELS_DIR / "model1_lulc_unet.pt"

    for epoch in range(1, NUM_EPOCHS + 1):
        if epoch == FREEZE_ENCODER_EPOCHS + 1:
            print("Unfreezing encoder.")
            set_encoder_trainable(model, True)

        t0 = time.time()
        train_loss = run_epoch(model, train_loader, loss_fn, optimizer, scaler, device, train=True)
        val_loss = run_epoch(model, val_loader, loss_fn, optimizer, scaler, device, train=False)
        dt = time.time() - t0

        print(f"Epoch {epoch:02d}/{NUM_EPOCHS}  train_loss={train_loss:.4f}  "
              f"val_loss={val_loss:.4f}  ({dt:.1f}s)")

        if val_loss < best_val:
            best_val = val_loss
            torch.save({"model_state": model.state_dict(), "epoch": epoch, "val_loss": val_loss}, ckpt_path)
            print(f"  -> saved best checkpoint ({ckpt_path.name})")

    print(f"\nDone. Best val_loss={best_val:.4f}. Checkpoint: {ckpt_path}")

    print("\n--- Accuracy report (best checkpoint, val set) ---")
    model.load_state_dict(torch.load(ckpt_path, map_location=device)["model_state"])
    cm = evaluate_model(model, val_loader, device, NUM_CLASSES)
    metrics = metrics_from_confusion(cm, CLASS_NAMES)
    print_metrics_report(metrics)
    plot_confusion_matrix(cm, CLASS_NAMES, OUTPUTS_DIR / "model1_confusion_matrix.png")


if __name__ == "__main__":
    main()
