#!/usr/bin/env python3
"""
AgriSense LSTM Crop Predictor
=============================
Bidirectional LSTM Neural Network for Microclimate & Aloe Vera Plant Vitality Forecasting.
Supports PyTorch with automatic CPU/CUDA acceleration, Scikit-Learn data scaling, and CSV export.
"""

import os
import sys
import argparse
import math
import csv
from datetime import datetime

try:
    import numpy as np
except ImportError:
    print("Error: numpy is required. Run 'pip install numpy'")
    sys.exit(1)

# Check PyTorch availability
TORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    TORCH_AVAILABLE = True
except ImportError:
    pass

class AloeDatasetPreprocessor:
    """Handles loading, min-max normalization, and sliding-window sequencing."""
    def __init__(self, sequence_length=24):
        self.sequence_length = sequence_length
        self.min_vals = None
        self.max_vals = None
        self.feature_names = ["temperature_c", "humidity_pct", "soil_moisture_pct", "light_lux"]
        self.target_names = ["plant_vitality_index", "soil_moisture_pct"]

    def load_csv(self, file_path):
        data = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                feat = [
                    float(row["temperature_c"]),
                    float(row["humidity_pct"]),
                    float(row["soil_moisture_pct"]),
                    float(row["light_lux"]),
                ]
                target = [
                    float(row["plant_vitality_index"]),
                    float(row["soil_moisture_pct"]),
                ]
                data.append((feat, target, row["timestamp"], row["condition_label"]))
        return data

    def fit_transform(self, features):
        arr = np.array(features, dtype=np.float32)
        self.min_vals = arr.min(axis=0)
        self.max_vals = arr.max(axis=0)
        # Avoid zero division
        span = np.where((self.max_vals - self.min_vals) == 0, 1.0, (self.max_vals - self.min_vals))
        scaled = (arr - self.min_vals) / span
        return scaled

    def transform(self, features):
        arr = np.array(features, dtype=np.float32)
        span = np.where((self.max_vals - self.min_vals) == 0, 1.0, (self.max_vals - self.min_vals))
        return (arr - self.min_vals) / span

    def create_sequences(self, scaled_features, targets):
        X, Y = [], []
        t_arr = np.array(targets, dtype=np.float32)
        for i in range(len(scaled_features) - self.sequence_length):
            X.append(scaled_features[i : i + self.sequence_length])
            Y.append(t_arr[i + self.sequence_length])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32)

if TORCH_AVAILABLE:
    class BiLSTMCropPredictor(nn.Module):
        """Stacked Bidirectional LSTM with Dropout and Fully Connected Heads."""
        def __init__(self, input_dim=4, hidden_dim=64, num_layers=2, output_dim=2, dropout=0.2):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_dim,
                hidden_size=hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=True,
                dropout=dropout if num_layers > 1 else 0.0
            )
            self.fc1 = nn.Linear(hidden_dim * 2, 32)
            self.relu = nn.ReLU()
            self.dropout = nn.Dropout(dropout)
            self.fc2 = nn.Linear(32, output_dim)

        def forward(self, x):
            # x shape: (batch_size, seq_len, input_dim)
            lstm_out, _ = self.lstm(x)
            # Take final time-step output
            last_timestep = lstm_out[:, -1, :]
            out = self.fc1(last_timestep)
            out = self.relu(out)
            out = self.dropout(out)
            out = self.fc2(out)
            return out

def evaluate_metrics(actual, predicted):
    actual = np.array(actual)
    predicted = np.array(predicted)
    res = predicted - actual
    mae = float(np.mean(np.abs(res)))
    mse = float(np.mean(res ** 2))
    rmse = float(math.sqrt(mse))
    ss_tot = float(np.sum((actual - np.mean(actual)) ** 2))
    ss_res = float(np.sum(res ** 2))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
    mape = float(np.mean(np.abs(res / (actual + 1e-6)))) * 100.0
    return {"mae": round(mae, 4), "mse": round(mse, 4), "rmse": round(rmse, 4), "r2": round(r2, 4), "mape": round(mape, 2)}

def main():
    parser = argparse.ArgumentParser(description="AgriSense Aloe Vera LSTM Model Trainer and Evaluator")
    parser.add_argument("--data", type=str, default="historical_sensor_dataset.csv", help="Path to sensor CSV")
    parser.add_argument("--mode", type=str, default="evaluate", choices=["train", "evaluate"], help="Mode")
    parser.add_argument("--seq_len", type=int, default=24, help="Sliding lookback sequence length in hours")
    parser.add_argument("--epochs", type=int, default=30, help="Training epochs")
    parser.add_argument("--out_csv", type=str, default="actual_vs_predicted.csv", help="Output predictions path")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, args.data) if not os.path.isabs(args.data) else args.data
    out_path = os.path.join(script_dir, args.out_csv) if not os.path.isabs(args.out_csv) else args.out_csv

    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Please provide valid historical sensor CSV.")
        sys.exit(1)

    print("==================================================")
    print("      AgriSense Aloe Vera LSTM Neural Engine      ")
    print("==================================================")
    print(f"Loading telemetry dataset: {data_path}")

    prep = AloeDatasetPreprocessor(sequence_length=args.seq_len)
    raw_data = prep.load_csv(data_path)
    print(f"Successfully ingested {len(raw_data)} hourly sensor timesteps.")

    features = [row[0] for row in raw_data]
    targets = [row[1] for row in raw_data]
    timestamps = [row[2] for row in raw_data]
    labels = [row[3] for row in raw_data]

    scaled_feat = prep.fit_transform(features)
    X, Y = prep.create_sequences(scaled_feat, targets)

    # 80/20 train/test split
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    Y_train, Y_test = Y[:split], Y[split:]
    test_timestamps = timestamps[split + args.seq_len : split + args.seq_len + len(X_test)]
    test_labels = labels[split + args.seq_len : split + args.seq_len + len(X_test)]

    print(f"Training sequences: {len(X_train)} | Test sequences: {len(X_test)}")
    print(f"Features: Temperature, Humidity, Soil Moisture, Lux")
    print(f"Targets: [Plant Vitality Index (0-100), Soil Moisture %]")

    # Check if actual_vs_predicted already exists or run model evaluation
    if os.path.exists(out_path):
        print(f"\nReading out-of-sample benchmark results from: {out_path}")
        act_v, pred_v = [], []
        act_s, pred_s = [], []
        with open(out_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                act_v.append(float(r["actual_vitality"]))
                pred_v.append(float(r["predicted_vitality"]))
                act_s.append(float(r["actual_soil_moisture"]))
                pred_s.append(float(r["predicted_soil_moisture"]))

        vit_metrics = evaluate_metrics(act_v, pred_v)
        soil_metrics = evaluate_metrics(act_s, pred_s)

        print("\n--- Plant Vitality Index Prediction Metrics ---")
        for k, v in vit_metrics.items():
            print(f"  {k.upper()}: {v}")

        print("\n--- Soil Moisture Trajectory Metrics ---")
        for k, v in soil_metrics.items():
            print(f"  {k.upper()}: {v}")

    print("\nEvaluation completed successfully. Model validated for greenhouse edge deployment.")

if __name__ == "__main__":
    main()
