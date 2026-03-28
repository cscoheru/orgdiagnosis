#!/usr/bin/env python3
"""
通过 HTTP API 种子元模型到运行中的服务器

用法: python scripts/seed_via_api.py [--base-url http://localhost:8000]

说明: KERNEL_MODE=demo 使用内存数据库，每次重启服务器需要重新种子。
      此脚本通过 HTTP API 调用运行中的服务器，无需直接访问数据库。
"""
import requests
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scripts.seed_meta_models import META_MODELS

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000/api/v1/kernel")


def seed_meta_models():
    print(f"Seeding {len(META_MODELS)} meta models via HTTP API...")
    print(f"Target: {BASE_URL}")

    success = 0
    for i, mm in enumerate(META_MODELS, 1):
        r = requests.post(f"{BASE_URL}/meta", json=mm, timeout=10)
        if r.status_code in (200, 201):
            print(f"  [{i:2d}/{len(META_MODELS)}] {mm['model_key']:25s} OK")
            success += 1
        elif r.status_code == 409:
            print(f"  [{i:2d}/{len(META_MODELS)}] {mm['model_key']:25s} SKIP (already exists)")
            success += 1
        else:
            print(f"  [{i:2d}/{len(META_MODELS)}] {mm['model_key']:25s} FAIL {r.status_code}")

    # Verify
    r = requests.get(f"{BASE_URL}/meta", timeout=10)
    count = len(r.json()) if r.status_code == 200 else 0
    print(f"\nResult: {success}/{len(META_MODELS)} seeded, {count} total in database")
    return success == len(META_MODELS)


if __name__ == "__main__":
    ok = seed_meta_models()
    sys.exit(0 if ok else 1)
