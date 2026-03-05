#!/bin/bash

# --- Configuration ---
export MODEL_ID="nvidia/Cosmos-Reason2-8B"
export PORT=8000
export VENV_NAME="cosmos_env"
export HF_TOKEN="your_token_here" 

echo "install python 3.12-dev"
sudo apt-get update && sudo apt-get install -y python3.12-dev

echo "🧟 Step 1: Cleaning up any old/zombie processes..."
sudo pkill -9 -f vllm
sudo pkill -9 -f "VLLM::EngineCore"
sudo fuser -k $PORT/tcp 2>/dev/null
sleep 2

# Step 2: Virtual Environment Setup
if [ ! -d "$VENV_NAME" ]; then
    echo "Installing uv and creating environment..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    # CORRECTED SOURCE PATH
    if [ -f "$HOME/.local/bin/env" ]; then
        source "$HOME/.local/bin/env"
    fi
    
    uv venv $VENV_NAME --python 3.12
fi
source $VENV_NAME/bin/activate

echo "Step 3: Installing vLLM and Dependencies..."
uv pip install -U vllm nvidia-cuda-runtime-cu12 nvidia-cudnn-cu12 huggingface_hub

# Step 4: Fix CUDA library paths
PYTHON_SITE=$(python -c "import site; print(site.getsitepackages()[0])")
export LD_LIBRARY_PATH=$PYTHON_SITE/nvidia/cuda_runtime/lib:$PYTHON_SITE/nvidia/cudnn/lib:$LD_LIBRARY_PATH
export VLLM_USE_V1=0
export HF_TOKEN=$HF_TOKEN

echo "Step 5: Pre-downloading Model Weights..."
hf download $MODEL_ID --token $HF_TOKEN

echo "Step 6: Clearing Triton cache..."
rm -rf ~/.triton/cache/*

echo "Step 7: Launching Cosmos Server..."
vllm serve "$MODEL_ID" \
    --port "$PORT" \
    --trust-remote-code \
    --reasoning-parser qwen3 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.6 \
    --enforce-eager \
    --media-io-kwargs '{"video": {"num_frames": -1}}'