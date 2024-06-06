# Royale Proxy API

![Royale Proxy API Logo](art/logo.jpg)

Welcome to the Royale Proxy API, your gateway to seamless integration with the official [Clash Royale API](https://developer.clashroyale.com/). Built with the robust [Nuxt.js](https://nuxt.com/), this project simplifies your development process by eliminating the need for IP whitelisting.

## 🌟 Motivation

The official Clash Royale API requires you to whitelist your server's IP address, which is a significant hurdle for building with the API. Royale Proxy API acts as a bridge, forwarding your requests to the official API without the need for whitelisting every connected client.

You just need to whitelist the server ip and provide the key, and let the server handle the rest!

## 🚀 Quick Start

1. **Get your API key** from the [Clash Royale Developer Portal](https://developer.clashroyale.com/).
2. **Whitelist your server or local IP address** on the developer portal.
3. **Clone this repository** and install the dependencies.
4. **Copy the `.env.example` file** to `.env` and add your API key.
5. **Run the development server** and start making requests!

### Install Dependencies

Pick your favorite package manager and install the necessary dependencies:

```bash
# Using npm
npm install

# Using pnpm
pnpm install

# Using yarn
yarn install

# Using bun
bun install
```

### Run the Development Server

Launch the development server at http://localhost:3000:

```bash

# Using npm

npm run dev

# Using pnpm

pnpm run dev

# Using yarn

yarn dev

# Using bun

bun run dev
```

### Production Ready

Prepare your application for production:

```bash

# Using npm

npm run build

# Using pnpm

pnpm run build

# Using yarn

yarn build

# Using bun

bun run build
```

### Preview your production build locally:

```bash
# Using npm
npm run preview

# Using pnpm
pnpm run preview

# Using yarn
yarn preview

# Using bun
bun run preview
```

For detailed deployment instructions, refer to the [Nuxt.js documentation](https://nuxt.com/docs/guide).

### 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

### ⚠️ Disclaimer

This project is unofficial and not endorsed by Supercell. For more information, review Supercell's Fan Content Policy: [https://supercell.com/en/fan-content-policy](https://supercell.com/en/fan-content-policy).
