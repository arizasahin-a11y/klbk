import os
import zipfile
import time

SRC_DIR = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT\dist\archives"
TARGET_DIR = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux"

BOOKS_DIR = os.path.join(TARGET_DIR, "books")
ASSETS_DIR = os.path.join(TARGET_DIR, "assets")

os.makedirs(BOOKS_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

tasks = [
    ("books1.zip", BOOKS_DIR),
    ("books2.zip", BOOKS_DIR),
    ("books3.zip", BOOKS_DIR),
    ("assets1.zip", ASSETS_DIR),
    ("assets2.zip", ASSETS_DIR),
]

total_start = time.time()
for zip_name, dest in tasks:
    zip_path = os.path.join(SRC_DIR, zip_name)
    print(f"Extracting {zip_name} to {dest} ...", flush=True)
    t0 = time.time()
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(dest)
    print(f"Finished {zip_name} in {time.time() - t0:.1f}s", flush=True)

print(f"All archives extracted successfully in {time.time() - total_start:.1f}s!", flush=True)
