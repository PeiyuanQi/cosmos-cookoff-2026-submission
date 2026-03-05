## Phytographer

A photo app driven by Cosmos-Reason-2 to boost your photo quality.



## Prerequisite

### Server side

- `nvidia/Cosmos-Reason2-8B` serving by `vllm`, assume the url is `IP:port`.
  - Script in this repo (`server/run-cosmos.sh`) is used to setup the machine on Nebius if Nebius does not successfully landed the image.

### Client side

- Since the website is not hosted on server, so you need to run the website in dev mode.
- Your laptop needs to havee camera so the local dev mode website could use camera to capture.