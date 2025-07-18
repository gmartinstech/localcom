# **App Name**: LocalCom

## Core Features:

- User Interface Cards: Displays two user cards, each representing a peer, with connection status indicators.
- Call Controls: Includes buttons to initiate and terminate voice calls using WebRTC.
- Text Chat: Enables P2P text message exchange through a text input field and display area.
- P2P Voice Calls: Utilizes WebRTC to establish peer-to-peer voice communication between browsers.
- P2P Data Channels: Implements data channels in WebRTC for direct text message transfer between peers.
- Signaling Server: Handles WebRTC signaling using a WebSocket server built into Next.js API Routes for SDP and ICE candidate exchange.
- Offline Functionality: Uses a service worker to cache the app's assets and UI for offline availability.

## Style Guidelines:

- Primary color: Soft blue (#A0D2EB) to represent local connectivity and calmness.
- Background color: Light gray (#F0F4F8) for a clean and modern interface.
- Accent color: Teal (#77DDE7) to highlight interactive elements and connection status.
- Body and headline font: 'Inter', a sans-serif font, will be used for its modern and neutral appearance.
- Simple, line-based icons to represent call functions and connection status clearly.
- Clean, card-based layout to display user interfaces, status, and message exchanges, optimizing ease of use on a local network.
- Subtle transition animations for status updates and message deliveries to give smooth user experience.