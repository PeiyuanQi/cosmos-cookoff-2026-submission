#!/bin/bash

# --- Configuration ---
export MODEL_ID="nvidia/Cosmos-Reason2-8B"
export MODEL_DIR="."
export PORT=8000
export VENV_NAME="cosmos_env"

echo "🔑 Enter your Hugging Face token (required for $MODEL_ID):"
read -s HF_TOKEN
echo

if [ -z "$HF_TOKEN" ]; then
    echo "Error: HF_TOKEN cannot be empty. Exiting."
    exit 1
fi

echo
echo "🧟 Step 1: Cleaning up any old/zombie processes..."
sudo pkill -9 -f vllm
sudo pkill -9 -f "VLLM::EngineCore"
sudo fuser -k $PORT/tcp 2>/dev/null
sleep 2

# Step 2: Virtual Environment Setup
echo
if [ ! -d "$VENV_NAME" ]; then
    echo "🐍 Installing uv and creating environment..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    # CORRECTED SOURCE PATH
    if [ -f "$HOME/.local/bin/env" ]; then
        source "$HOME/.local/bin/env"
    fi
    
    uv venv $VENV_NAME --python 3.12
fi
source $VENV_NAME/bin/activate

echo
echo "📦 Step 3: Installing vLLM and Dependencies..."
uv pip install -U vllm nvidia-cuda-runtime-cu12 nvidia-cudnn-cu12 huggingface_hub

# Step 4: Fix CUDA library paths
PYTHON_SITE=$(python -c "import site; print(site.getsitepackages()[0])")
export LD_LIBRARY_PATH=$PYTHON_SITE/nvidia/cuda_runtime/lib:$PYTHON_SITE/nvidia/cudnn/lib:$LD_LIBRARY_PATH
export VLLM_USE_V1=0
export HF_TOKEN=$HF_TOKEN

echo
echo "📥 Step 5: Pre-downloading Model Weights to $MODEL_DIR..."
if [ ! -d "$MODEL_DIR" ] || [ -z "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
    hf download $MODEL_ID --local-dir "$MODEL_DIR" --token $HF_TOKEN
else
    echo "   (already present, skipping download)"
fi

echo
echo "🧪 Step 6: Clearing Triton cache..."
rm -rf ~/.triton/cache/*

echo
echo "🚀 Step 7: Launching Cosmos Server (from $MODEL_DIR)..."
vllm serve "$MODEL_DIR" \
    --port "$PORT" \
    --allowed-origins '*' \
    --trust-remote-code \
    --reasoning-parser qwen3 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.9 \
    --enforce-eager \
    --media-io-kwargs '{"video": {"num_frames": -1}}'