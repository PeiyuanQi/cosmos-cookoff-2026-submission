## Phytographer

A photo app driven by Cosmos-Reason-2 to boost your photo quality.

Are you worried your significant-other complain you never understand how to take good photos?

Are you getting difficulty to find time to learn basics of phtography?

*Phytographer* is your solution!

Powered by the magnificent `nvidia/Cosmos-Reason2-8B`, a model understand light, position, physics of objectives, framing, exposure...

Everything you need to know about photography!

Try out now and don't miss it 🥹

**Featrues:**
- Score your photos.
- Gives quick comments on how to improve this photo, so you could fix it immediately.
- Save the photos so you keep it!

> NOTE: Ideally this should be a Android / iOS App, given the limitation of distributing the app, a web app is used instead.

## Prerequisite and setup

### Server side

- `nvidia/Cosmos-Reason2-8B` serving by `vllm`, assume the url is `IP:port`.
  - Script in this repo (`server/run-cosmos.sh`) is used to setup the machine on Nebius if Nebius does not successfully landed the image. Note update your Huggingface token in the script.
  - The machine used on Nebius is **NVIDIA® L40S Intel**.
  - Only 60% of GPU mem is used to avoid VLLM crash due to various reasons.
  - Noticed in some cases, the Nebius machine still crashes, so `--max-model-len 16384` need to be halfed, and do not append `--media-io-kwargs '{"video": {"num_frames": -1}}'` flag.

### Client side

1. Point the endpoint to your running `cosmos-reason2-8B` model `IP:PORT`, by modifying `client/public/server-url.txt`.
2. Since the website is not hosted on server, so you need to run the website in dev mode.
```
cd client
nvm use 24 # install nvm first if you don't have it
npm install
npm run dev
```
Then access the link shown in the terminal, e.g. `http://localhost:5173/`.
3. Your laptop needs to have camera so the local dev mode website could use camera to capture.

### Demo

[Video Drive Link](https://drive.google.com/file/d/1dqZ-TyNCsuOnWSu9DsDLHa83ttA-Yk5I/view?usp=drive_link)

### Physical AI

Photography is a highly logical activity, a good photo needs to understand the advantage of object, the environment, the light, the relationships between objects. These are natually a result of physic rules. The ability to generate image of AI does not mean they understand the objects relationships and so on, while a physical AI can.

### Future improvements

- Add ability to stream the preview of camera to the server for real time suggestions.
- Add the overlay of 50% translucency which gives symbols to hint user how to change the device to get optimal photo.
